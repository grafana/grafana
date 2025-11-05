import { KBarProvider } from 'kbar';
import { render, screen } from 'test/test-utils';

import { useAssistant } from '@grafana/assistant';
import { setPluginLinksHook } from '@grafana/runtime';
import { setGetObservablePluginLinks } from '@grafana/runtime/internal';

import { getObservablePluginLinks } from '../plugins/extensions/getPluginExtensions';

import { CommandPalette } from './CommandPalette';

setPluginLinksHook(() => ({
  links: [],
  isLoading: false,
}));
setGetObservablePluginLinks(getObservablePluginLinks);

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

describe('CommandPalette', () => {
  it('should render empty state with AI Assistant button when no results and assistant is available', async () => {
    // Mock assistant being available
    (useAssistant as jest.Mock).mockReturnValue({ isAvailable: true });
    setup();

    // Check if empty state message is rendered
    expect(await screen.findByText('No results found')).toBeInTheDocument();
    // Check if AI Assistant button is rendered with correct props
    expect(screen.getByRole('button', { name: 'Try searching with Grafana Assistant' })).toBeInTheDocument();
  });

  it('should render empty state without AI Assistant button when assistant is not available', async () => {
    // Mock assistant being unavailable
    (useAssistant as jest.Mock).mockReturnValue({ isAvailable: false });
    setup();

    // Check if empty state message is rendered
    expect(await screen.findByText('No results found')).toBeInTheDocument();
    // Check that AI Assistant button is not rendered
    expect(screen.queryByRole('button', { name: 'Try searching with Grafana Assistant' })).not.toBeInTheDocument();
  });
});
