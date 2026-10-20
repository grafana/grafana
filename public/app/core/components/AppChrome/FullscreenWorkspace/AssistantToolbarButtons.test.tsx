import { act } from '@testing-library/react';
import { useAsync } from 'react-use';
import { getWrapper, render, screen, fireEvent } from 'test/test-utils';

import { EventBusSrv, store } from '@grafana/data';
import { setAppEvents, usePluginLinks } from '@grafana/runtime';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { AppChromeService } from 'app/core/components/AppChrome/AppChromeService';
import { ExtensionSidebarContextProvider } from 'app/core/components/AppChrome/ExtensionSidebar/ExtensionSidebarProvider';

import { AssistantToolbarButtons } from './AssistantToolbarButtons';

const FULLSCREEN_WORKSPACE_FLAG = 'assistant.fullscreenWorkspace';
const ASSISTANT_PLUGIN_ID = 'grafana-assistant-app';

jest.mock('@grafana/data', () => ({
  ...jest.requireActual('@grafana/data'),
  store: {
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    getObject: jest.fn().mockImplementation((_key: string, defaultValue: unknown) => defaultValue),
  },
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  usePluginLinks: jest.fn(),
}));

jest.mock('react-use', () => ({
  ...jest.requireActual('react-use'),
  useAsync: jest.fn(),
}));

const mockComponent = { title: 'Grafana Assistant', description: '', targets: [] };
const mockPluginMeta = { pluginId: ASSISTANT_PLUGIN_ID, addedComponents: [mockComponent] };

const mockMatchMedia = (matches: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    value: jest.fn().mockImplementation(() => ({
      matches,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    })),
    writable: true,
  });
};

function renderButtons() {
  const chrome = new AppChromeService();
  const wrapper = getWrapper({ grafanaContext: { chrome } });
  return {
    chrome,
    ...render(
      <ExtensionSidebarContextProvider>
        <AssistantToolbarButtons />
      </ExtensionSidebarContextProvider>,
      { wrapper }
    ),
  };
}

describe('AssistantToolbarButtons', () => {
  const useAsyncMock = jest.mocked(useAsync);

  beforeEach(async () => {
    jest.clearAllMocks();
    mockMatchMedia(true); // large screen by default
    useAsyncMock.mockReturnValue({ loading: false, value: new Map([[mockPluginMeta.pluginId, mockPluginMeta]]) });
    (usePluginLinks as jest.Mock).mockReturnValue({
      links: [{ pluginId: mockPluginMeta.pluginId, title: mockComponent.title }],
      isLoading: false,
    });
    (store.get as jest.Mock).mockClear();
    (store.set as jest.Mock).mockClear();
    (store.delete as jest.Mock).mockClear();
    setAppEvents(new EventBusSrv());
    // setTestFlags fires OpenFeature events that update React state; wrap in act() since the
    // component may still be mounted when this runs (RTL cleanup is a separate afterEach).
    await act(async () => {
      setTestFlags({ [FULLSCREEN_WORKSPACE_FLAG]: true });
    });
  });

  afterEach(async () => {
    await act(async () => {
      setTestFlags({});
    });
  });

  it('renders nothing when the fullscreen workspace flag is off', async () => {
    await act(async () => {
      setTestFlags({ [FULLSCREEN_WORKSPACE_FLAG]: false });
    });

    renderButtons();

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders nothing on small screens', () => {
    mockMatchMedia(false);

    renderButtons();

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders nothing when the assistant plugin is not available', () => {
    useAsyncMock.mockReturnValue({ loading: false, value: new Map() });

    renderButtons();

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders the Chat pill in its closed state and a Workspace button', () => {
    renderButtons();

    const pill = screen.getByTestId('extension-toolbar-button-open');
    expect(pill).toBeInTheDocument();
    expect(pill).toHaveAttribute('aria-label', 'Open Grafana Assistant');
    expect(pill).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Chat')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Workspace' })).toBeInTheDocument();
  });

  it('toggles the docked component when the Chat pill is clicked', () => {
    renderButtons();

    const pill = screen.getByTestId('extension-toolbar-button-open');
    fireEvent.click(pill);

    const closedPill = screen.getByTestId('extension-toolbar-button-close');
    expect(closedPill).toHaveAttribute('aria-label', 'Close Grafana Assistant');
    expect(closedPill).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(closedPill);
    expect(screen.getByTestId('extension-toolbar-button-open')).toHaveAttribute('aria-expanded', 'false');
  });

  it('enters fullscreen workspace when the Workspace button is clicked', () => {
    const { chrome } = renderButtons();

    fireEvent.click(screen.getByRole('button', { name: 'Workspace' }));

    expect(chrome.state.getValue().fullscreenWorkspace).toBe(true);
  });
});
