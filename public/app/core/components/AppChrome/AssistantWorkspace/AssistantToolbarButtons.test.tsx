import { act } from '@testing-library/react';
import { useAsync } from 'react-use';
import { getWrapper, render, screen, fireEvent } from 'test/test-utils';

import { EventBusSrv, store } from '@grafana/data';
import { locationService, setAppEvents, usePluginLinks } from '@grafana/runtime';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { AppChromeService } from 'app/core/components/AppChrome/AppChromeService';
import {
  ExtensionSidebarContextProvider,
  useExtensionSidebarContext,
} from 'app/core/components/AppChrome/ExtensionSidebar/ExtensionSidebarProvider';
import { getComponentIdFromComponentMeta } from 'app/core/components/AppChrome/ExtensionSidebar/extensionSidebarUtils';

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

jest.mock('@grafana/runtime', () => {
  const actual = jest.requireActual('@grafana/runtime');
  return {
    ...actual,
    // Read through, so the location service the test wrapper installs is the one both sides use.
    get locationService() {
      return actual.locationService;
    },
    usePluginLinks: jest.fn(),
  };
});

jest.mock('@grafana/assistant', () => ({
  ASSISTANT_PLUGIN_ID: 'grafana-assistant-app',
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

const assistantComponentId = getComponentIdFromComponentMeta(ASSISTANT_PLUGIN_ID, mockComponent.title);

function DockedComponent() {
  const { dockedComponentId, setDockedComponentId } = useExtensionSidebarContext();
  return (
    <>
      <output aria-label="docked">{dockedComponentId ?? ''}</output>
      <button onClick={() => setDockedComponentId(undefined)}>Close sidebar</button>
    </>
  );
}

function renderButtons(initialUrl = '/explore?left=1', chrome = new AppChromeService()) {
  const wrapper = getWrapper({
    grafanaContext: { chrome },
    renderWithRouter: true,
    historyOptions: { initialEntries: [initialUrl] },
  });
  return render(
    <ExtensionSidebarContextProvider>
      <AssistantToolbarButtons />
      <DockedComponent />
    </ExtensionSidebarContextProvider>,
    { wrapper }
  );
}

function navigate(url: string) {
  act(() => locationService.push(url));
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
    (store.get as jest.Mock).mockReset();
    (store.set as jest.Mock).mockClear();
    (store.delete as jest.Mock).mockClear();
    window.sessionStorage.clear();
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

    expect(screen.queryByRole('button', { name: /Workspace|Grafana Assistant/ })).not.toBeInTheDocument();
  });

  it('renders nothing on small screens', () => {
    mockMatchMedia(false);

    renderButtons();

    expect(screen.queryByRole('button', { name: /Workspace|Grafana Assistant/ })).not.toBeInTheDocument();
  });

  it('renders nothing when the assistant plugin is not available', () => {
    useAsyncMock.mockReturnValue({ loading: false, value: new Map() });

    renderButtons();

    expect(screen.queryByRole('button', { name: /Workspace|Grafana Assistant/ })).not.toBeInTheDocument();
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

  it('opens the Assistant Workspace when the Workspace button is clicked', () => {
    renderButtons();

    fireEvent.click(screen.getByRole('button', { name: 'Workspace' }));

    expect(locationService.getLocation().pathname).toBe('/a/grafana-assistant-app/workspace');
  });

  it('continues the chat open in the sidebar when opening the workspace', () => {
    (store.get as jest.Mock).mockImplementation((key: string) =>
      key === 'grafana-assistant-active-chat-id' ? 'chat-1' : assistantComponentId
    );
    renderButtons();

    fireEvent.click(screen.getByRole('button', { name: 'Workspace' }));

    expect(locationService.getLocation().pathname).toBe('/a/grafana-assistant-app/workspace/chat-1');
  });

  it('shows only Exit Workspace on the workspace, even while the plugin hides its sidebar entry there', () => {
    useAsyncMock.mockReturnValue({ loading: false, value: new Map() });
    renderButtons('/a/grafana-assistant-app/pages/new');

    expect(screen.getByRole('button', { name: 'Exit Workspace' })).toBeInTheDocument();
    expect(screen.queryByText('Chat')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Workspace' })).not.toBeInTheDocument();
  });

  it('returns to the page visited before the workspace, past conversations opened in it', () => {
    renderButtons();
    navigate('/d/abc?from=now-1h#panel');
    navigate('/a/grafana-assistant-app/workspace');
    navigate('/a/grafana-assistant-app/workspace/chat-2');

    fireEvent.click(screen.getByRole('button', { name: 'Exit Workspace' }));

    const { pathname, search, hash } = locationService.getLocation();
    expect(pathname + search + hash).toBe('/d/abc?from=now-1h#panel');
  });

  it('exits to Home when the workspace was the first page in this tab', () => {
    renderButtons('/a/grafana-assistant-app/workspace');

    fireEvent.click(screen.getByRole('button', { name: 'Exit Workspace' }));

    expect(locationService.getLocation().pathname).toBe('/');
  });

  it('reopens the assistant sidebar that was open before the workspace when the user leaves it', () => {
    renderButtons();
    fireEvent.click(screen.getByTestId('extension-toolbar-button-open'));
    navigate('/a/grafana-assistant-app/workspace');
    // The plugin closes the sidebar while the workspace shows the chat.
    fireEvent.click(screen.getByRole('button', { name: 'Close sidebar' }));
    expect(screen.getByRole('status', { name: 'docked' })).toHaveTextContent('');

    fireEvent.click(screen.getByRole('button', { name: 'Exit Workspace' }));

    expect(screen.getByRole('status', { name: 'docked' })).toHaveTextContent(assistantComponentId);
  });

  it('closes the docked mega menu on the workspace and reopens it on the way out, without saving either', () => {
    const chrome = new AppChromeService();
    chrome.update({ megaMenuDocked: true, megaMenuOpen: true });
    renderButtons('/explore?left=1', chrome);

    navigate('/a/grafana-assistant-app/workspace');
    expect(chrome.state.getValue().megaMenuOpen).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Exit Workspace' }));
    expect(chrome.state.getValue().megaMenuOpen).toBe(true);
    expect(store.set).not.toHaveBeenCalledWith('grafana.navigation.open', expect.anything());
  });

  it('keeps the mega menu closed after the workspace when it was closed before', () => {
    const chrome = new AppChromeService();
    chrome.update({ megaMenuDocked: true, megaMenuOpen: false });
    renderButtons('/explore?left=1', chrome);

    navigate('/a/grafana-assistant-app/workspace');
    fireEvent.click(screen.getByRole('button', { name: 'Exit Workspace' }));

    expect(chrome.state.getValue().megaMenuOpen).toBe(false);
  });
});
