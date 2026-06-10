import { KBarProvider } from 'kbar';
import { act, render, screen, userEvent } from 'test/test-utils';

import { useAssistant } from '@grafana/assistant';
import { setBackendSrv, setPluginLinksHook } from '@grafana/runtime';
import { setGetObservablePluginLinks } from '@grafana/runtime/internal';
import { getDashboardMemorySearchHandler } from '@grafana/test-utils/handlers';
import { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';

import { getObservablePluginLinks } from '../plugins/extensions/getPluginExtensions';

import { CommandPalette } from './CommandPalette';

setPluginLinksHook(() => ({
  links: [],
  isLoading: false,
}));
setGetObservablePluginLinks(getObservablePluginLinks);

setBackendSrv(backendSrv);
const server = setupMockServer();

jest.mock('@grafana/assistant', () => ({
  ...jest.requireActual('@grafana/assistant'),
  useAssistant: jest.fn(),
  OpenAssistantButton: jest.fn().mockImplementation(({ title }) => <button>{title}</button>),
}));

jest.mock('kbar', () => ({
  ...jest.requireActual('kbar'),
  KBarPortal: jest.fn().mockImplementation(({ children }) => <div>{children}</div>),
  KBarAnimator: jest.fn().mockImplementation(({ children }) => <div>{children}</div>),
}));

const setup = () => {
  return render(
    <KBarProvider>
      <CommandPalette />
    </KBarProvider>
  );
};

const triggerEmptyState = async () => {
  const user = userEvent.setup();
  // Type a nonsense query to trigger the empty state naturally, rather than relying on
  // kbar's useThrottledValue timing with an empty search (which causes flakiness)
  const input = screen.getByPlaceholderText('Search or jump to...');
  await user.type(input, 'zzznomatch');
};

describe('CommandPalette', () => {
  it('should render empty state with AI Assistant button when no results and assistant is available', async () => {
    // Mock assistant being available
    (useAssistant as jest.Mock).mockReturnValue({ isLoading: false, isAvailable: true });
    setup();
    await triggerEmptyState();

    // The empty state now waits for the deep search fetch (500ms debounce) to settle
    expect(await screen.findByText('No results found', {}, { timeout: 3000 })).toBeInTheDocument();
    // Check if AI Assistant button is rendered with correct props
    expect(screen.getByRole('button', { name: 'Search with Grafana Assistant' })).toBeInTheDocument();
  });

  it('should render empty state without AI Assistant button when assistant is not available', async () => {
    // Mock assistant being unavailable
    (useAssistant as jest.Mock).mockReturnValue({ isLoading: false, isAvailable: false });
    setup();
    await triggerEmptyState();

    // Check if empty state message is rendered
    expect(await screen.findByText('No results found', {}, { timeout: 3000 })).toBeInTheDocument();
    // Check that AI Assistant button is not rendered
    expect(screen.queryByRole('button', { name: 'Search with Grafana Assistant' })).not.toBeInTheDocument();
  });

  describe('deep search column', () => {
    afterEach(() => {
      server.events.removeAllListeners();
    });

    it('shows grouped deep search results when the assistant is available', async () => {
      (useAssistant as jest.Mock).mockReturnValue({ isLoading: false, isAvailable: true });
      server.use(
        getDashboardMemorySearchHandler([
          {
            dashboardUid: 'dash-1',
            dashboardTitle: 'API latency',
            content: 'p99 latency by region',
            score: 0.1,
            folderTitle: 'Observability',
          },
          { dashboardUid: 'dash-1', dashboardTitle: 'API latency', content: 'p50 latency', score: 0.2 },
        ])
      );

      setup();
      const user = userEvent.setup();
      await user.type(screen.getByPlaceholderText('Search or jump to...'), 'latency');

      expect(await screen.findByText('Deep search')).toBeInTheDocument();
      // Deep search debounces for 500ms, so allow extra time for results
      expect(await screen.findByText('API latency', {}, { timeout: 3000 })).toBeInTheDocument();
      expect(screen.getByText('p99 latency by region')).toBeInTheDocument();
      expect(screen.getByText('Observability')).toBeInTheDocument();
      expect(screen.getByText('2 matches')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /API latency/ })).toHaveAttribute('href', '/d/dash-1');
    });

    it('hides the empty state when only deep search has results', async () => {
      (useAssistant as jest.Mock).mockReturnValue({ isLoading: false, isAvailable: true });
      server.use(
        getDashboardMemorySearchHandler([
          { dashboardUid: 'dash-1', dashboardTitle: 'API latency', content: 'p99 latency', score: 0.1 },
        ])
      );

      setup();
      const user = userEvent.setup();
      // A query that matches no keyword results but returns deep search hits
      await user.type(screen.getByPlaceholderText('Search or jump to...'), 'zzznomatch');

      expect(await screen.findByText('API latency', {}, { timeout: 3000 })).toBeInTheDocument();
      expect(screen.queryByText('No results found')).not.toBeInTheDocument();
    });

    it('does not render the deep search column when the assistant is unavailable', async () => {
      (useAssistant as jest.Mock).mockReturnValue({ isLoading: false, isAvailable: false });
      let deepSearchCalled = false;
      server.events.on('request:start', ({ request }) => {
        if (request.url.includes('memory/dashboards')) {
          deepSearchCalled = true;
        }
      });

      setup();
      const user = userEvent.setup();
      await user.type(screen.getByPlaceholderText('Search or jump to...'), 'latency');

      expect(screen.queryByText('Deep search')).not.toBeInTheDocument();
      // Outwait the 500ms deep search debounce to prove no request fires
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 600));
      });
      expect(deepSearchCalled).toBe(false);
      expect(screen.queryByText('Deep search')).not.toBeInTheDocument();
    });
  });
});
