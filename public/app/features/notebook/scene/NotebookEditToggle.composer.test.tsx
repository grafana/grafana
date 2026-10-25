import { act, fireEvent, render, screen, within } from 'test/test-utils';

import { getPanelPlugin } from '@grafana/data/test';
import { config, setPluginImportUtils } from '@grafana/runtime';
import { SceneRefreshPicker, SceneTimePicker, SceneTimeRange } from '@grafana/scenes';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { appEvents } from 'app/core/app_events';
import {
  type ExtensionSidebarContextType,
  useExtensionSidebarContext,
} from 'app/core/components/AppChrome/ExtensionSidebar/ExtensionSidebarProvider';
import {
  getEffectiveExtensionSidebarPresentation,
  resetExtensionSidebarPresentationForTests,
  setExtensionSidebarPresentation,
} from 'app/core/components/AppChrome/ExtensionSidebar/extensionSidebarLayout';
import { getComponentIdFromComponentMeta } from 'app/core/components/AppChrome/ExtensionSidebar/extensionSidebarUtils';
import { contextSrv } from 'app/core/services/context_srv';
import {
  addComposerEnterRequestListener,
  getPendingComposerEnterTarget,
  getSupportedComposerResources,
  resetComposerEnterRequestsForTests,
  PENDING_REQUEST_TTL_MS,
  settleComposerEnterRequest,
  wasComposerEnterRequestDocked,
} from 'app/features/dashboard-scene/composer/composerEntryRequests';
import { composerApi } from 'app/features/plugins/components/restrictedGrafanaApis/composer/composerApi';
import { OpenExtensionSidebarEvent } from 'app/types/events';

import { enterNotebookComposer } from '../composer/NotebookComposerDocument';
import { setRouteNotebook } from '../composer/notebookComposerAccess';
import { NOTEBOOKS_FLAG } from '../mutation-api/test-utils';

import { NotebookEditToggle } from './NotebookEditToggle';
import { NotebookEmbeddedHost } from './NotebookEmbeddedContext';
import { NotebookScene } from './NotebookScene';
import { NotebookCellItem } from './layout-notebook/NotebookCellItem';
import { NotebookLayoutManager } from './layout-notebook/NotebookLayoutManager';

// The Assistant's sidebar: the plugin that may float.
const sidebarPresentation = () => getEffectiveExtensionSidebarPresentation('grafana-assistant-app');

jest.mock('app/core/components/AppChrome/ExtensionSidebar/ExtensionSidebarProvider', () => ({
  ...jest.requireActual('app/core/components/AppChrome/ExtensionSidebar/ExtensionSidebarProvider'),
  useExtensionSidebarContext: jest.fn(),
}));

setPluginImportUtils({
  importPanelPlugin: () => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: () => undefined,
});

const ASSISTANT = 'grafana-assistant-app';
const TITLE = 'Grafana Assistant';
const TARGET = { resource: 'notebook', uid: 'nb-toggle' } as const;
const cleanups: Array<() => void> = [];

function sidebarContext(assistant: 'available' | 'missing', docked = false): ExtensionSidebarContextType {
  return {
    isOpen: docked,
    dockedComponentId: docked ? getComponentIdFromComponentMeta(ASSISTANT, TITLE) : undefined,
    setDockedComponentId: jest.fn(),
    availableComponents:
      assistant === 'available'
        ? new Map([[ASSISTANT, { addedComponents: [{ title: TITLE, targets: [], description: '' }], addedLinks: [] }]])
        : new Map(),
    extensionSidebarWidth: 300,
    setExtensionSidebarWidth: jest.fn(),
    floatingExtensionSidebarWidth: 480,
    setFloatingExtensionSidebarWidth: jest.fn(),
    presentation: 'docked',
    floatingHidden: false,
  };
}

/** Assistant listening for entry requests on dashboards and notebooks. */
let assistant: jest.Mock;
let stopAssistant = () => {};

beforeEach(() => {
  assistant = jest.fn();
  stopAssistant = addComposerEnterRequestListener(assistant, { resources: ['dashboard', 'notebook'] });
  cleanups.push(() => stopAssistant());
  setTestFlags({ [NOTEBOOKS_FLAG]: true, 'grafana.notebookComposer': true });
  jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
  jest.mocked(useExtensionSidebarContext).mockReturnValue(sidebarContext('available'));
});

afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  resetComposerEnterRequestsForTests();
  resetExtensionSidebarPresentationForTests();
  jest.useRealTimers();
  jest.restoreAllMocks();
  setTestFlags({});
});

function notebook({ isDraft = false }: { isDraft?: boolean } = {}) {
  const scene = new NotebookScene({
    title: 'Toggle',
    uid: 'nb-toggle',
    isDraft,
    body: new NotebookLayoutManager({
      cells: [
        new NotebookCellItem({
          elementName: 'intro',
          source: 'user',
          content: { kind: 'Markdown', spec: { text: 'Hello' } },
        }),
      ],
    }),
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    timePicker: new SceneTimePicker({}),
    refreshPicker: new SceneRefreshPicker({}),
  });
  cleanups.push(scene.activate());
  cleanups.push(setRouteNotebook(scene));
  return scene;
}

const radio = (name: string) => screen.queryByRole('radio', { name });
const composerOption = () => radio('Composer');

describe('Composer in the notebook mode switch', () => {
  it('is the third option, after View and Edit, with the sparkle and its description', async () => {
    const { user } = render(<NotebookEditToggle notebook={notebook()} />);

    expect(screen.getAllByRole('radio').map((option) => option.closest('div')?.textContent)).toEqual([
      'View',
      'Edit',
      'Composer',
    ]);
    expect(within(screen.getByText('Composer').closest('label')!).getByTestId('icon-ai-sparkle')).toBeInTheDocument();
    await user.hover(composerOption()!);
    expect(await screen.findByText('Point at cells and regions and ask Assistant to change them')).toBeInTheDocument();
  });

  it.each([
    ['its toggle is off', () => setTestFlags({ [NOTEBOOKS_FLAG]: true })],
    [
      'Assistant has not registered',
      () => jest.mocked(useExtensionSidebarContext).mockReturnValue(sidebarContext('missing')),
    ],
  ])('is left out while %s, leaving View and Edit', (_, arrange) => {
    arrange();
    render(<NotebookEditToggle notebook={notebook()} />);

    expect(radio('View')).toBeInTheDocument();
    expect(radio('Edit')).toBeInTheDocument();
    expect(composerOption()).not.toBeInTheDocument();
  });

  it('follows the document types Assistant listens for', () => {
    // Assistant registered without options: dashboards only.
    stopAssistant();
    let stop = addComposerEnterRequestListener(jest.fn());
    render(<NotebookEditToggle notebook={notebook()} />);
    expect(composerOption()).not.toBeInTheDocument();

    act(() => {
      stop();
      stop = addComposerEnterRequestListener(jest.fn(), { resources: ['dashboard', 'notebook'] });
    });
    expect(composerOption()).toBeInTheDocument();

    // Registered again with a narrower list: the notebook option goes.
    act(() => {
      stop();
      stop = addComposerEnterRequestListener(jest.fn(), { resources: ['dashboard'] });
    });
    expect(composerOption()).not.toBeInTheDocument();

    act(() => {
      stop();
      stop = addComposerEnterRequestListener(jest.fn(), { resources: ['notebook'] });
    });
    expect(composerOption()).toBeInTheDocument();

    // Nothing listens.
    act(() => stop());
    expect(composerOption()).not.toBeInTheDocument();
    expect(radio('View')).toBeInTheDocument();
  });

  it('is left out on a fresh page before Assistant registers, where only dashboards are assumed', () => {
    const original = {
      allow: config.bootData.settings.pluginRestrictedAPIsAllowList,
    };
    cleanups.push(() => {
      config.bootData.settings.pluginRestrictedAPIsAllowList = original.allow;
    });
    stopAssistant();
    resetComposerEnterRequestsForTests();
    setTestFlags({
      [NOTEBOOKS_FLAG]: true,
      'grafana.notebookComposer': true,
      dashboardNewLayouts: true,
      'grafana.dashboardPreviewMode': true,
      'grafana.dashboardComposer': true,
    });
    config.bootData.settings.pluginRestrictedAPIsAllowList = { composer: [ASSISTANT] };

    render(<NotebookEditToggle notebook={notebook()} />);

    expect(getSupportedComposerResources()).toEqual(['dashboard']);
    expect(radio('Edit')).toBeInTheDocument();
    expect(composerOption()).not.toBeInTheDocument();
  });

  it('is left out while Composer cannot start on the notebook, such as a draft', () => {
    render(<NotebookEditToggle notebook={notebook({ isDraft: true })} />);
    expect(composerOption()).not.toBeInTheDocument();
  });

  it('is left out where a host such as the Assistant canvas draws the notebook', () => {
    render(
      <NotebookEmbeddedHost>
        <NotebookEditToggle notebook={notebook()} />
      </NotebookEmbeddedHost>
    );
    expect(radio('Edit')).toBeInTheDocument();
    expect(composerOption()).not.toBeInTheDocument();
  });

  it('opens a closed Assistant sidebar already floating and hands the request to Assistant', async () => {
    const originalPublish = appEvents.publish.bind(appEvents);
    const layoutWhenOpened: string[] = [];
    const publish = jest.spyOn(appEvents, 'publish').mockImplementation((event) => {
      if (event instanceof OpenExtensionSidebarEvent) {
        layoutWhenOpened.push(sidebarPresentation());
      }
      originalPublish(event);
    });
    const { user } = render(<NotebookEditToggle notebook={notebook()} />);

    await user.click(composerOption()!);

    const opened = publish.mock.calls
      .map(([event]) => event)
      .filter((event) => event instanceof OpenExtensionSidebarEvent);
    expect(opened.map((event) => event.payload)).toEqual([{ pluginId: ASSISTANT, componentTitle: TITLE }]);
    // The request floats the sidebar before it opens (the floating flag is off here).
    expect(layoutWhenOpened).toEqual(['floating']);
    expect(assistant).toHaveBeenCalledWith(TARGET);
    expect(sidebarPresentation()).toBe('floating');
  });

  it('shows Composer selected while the request waits, and keeps it once the session starts', async () => {
    const scene = notebook();
    const { user } = render(<NotebookEditToggle notebook={scene} />);

    await user.click(composerOption()!);
    expect(composerOption()).toBeChecked();
    expect(scene.state.isComposing).toBeFalsy();

    await act(async () => {
      await composerApi.enter(TARGET);
    });

    expect(scene.state.isComposing).toBe(true);
    expect(composerOption()).toBeChecked();
  });

  it('falls back to the mode the notebook is in when entering fails', async () => {
    const scene = notebook();
    const { user } = render(<NotebookEditToggle notebook={scene} />);
    await user.click(radio('Edit')!);
    await user.click(composerOption()!);
    expect(composerOption()).toBeChecked();

    act(() => settleComposerEnterRequest(TARGET.uid));

    expect(radio('Edit')).toBeChecked();
    expect(scene.state.isEditing).toBe(true);
  });

  it('falls back to the previous mode when nobody takes the request within the expiry', async () => {
    jest.useFakeTimers();
    render(<NotebookEditToggle notebook={notebook()} />);

    fireEvent.click(composerOption()!);
    expect(composerOption()).toBeChecked();
    expect(sidebarPresentation()).toBe('floating');
    act(() => jest.advanceTimersByTime(PENDING_REQUEST_TTL_MS + 1));

    expect(radio('View')).toBeChecked();
    expect(getPendingComposerEnterTarget()).toBeUndefined();
    expect(sidebarPresentation()).toBe('docked');
  });

  it('falls back at once, and docks the sidebar again, when Assistant declines the request', async () => {
    stopAssistant();
    const decline = jest.fn(() => false);
    stopAssistant = addComposerEnterRequestListener(decline, { resources: ['notebook'] });
    const { user } = render(<NotebookEditToggle notebook={notebook()} />);

    await user.click(composerOption()!);

    expect(decline).toHaveBeenCalledWith(TARGET);
    expect(radio('View')).toBeChecked();
    expect(getPendingComposerEnterTarget()).toBeUndefined();
    expect(sidebarPresentation()).toBe('docked');
  });

  it('withdraws a waiting request when the user picks another mode', async () => {
    const { user } = render(<NotebookEditToggle notebook={notebook()} />);
    await user.click(composerOption()!);

    await user.click(radio('View')!);

    expect(radio('View')).toBeChecked();
    expect(getPendingComposerEnterTarget()).toBeUndefined();
  });

  it('still hands the request over, docked, when the user docks the sidebar while it waits', async () => {
    const { user } = render(<NotebookEditToggle notebook={notebook()} />);
    await user.click(composerOption()!);

    setExtensionSidebarPresentation('docked');

    expect(sidebarPresentation()).toBe('docked');
    expect(wasComposerEnterRequestDocked(TARGET.uid)).toBe(true);
    expect(assistant).toHaveBeenCalledWith(TARGET);
    expect(getPendingComposerEnterTarget()).toEqual(TARGET);
  });

  it('asks a listening Assistant straight away, without entering Composer itself', async () => {
    jest.mocked(useExtensionSidebarContext).mockReturnValue(sidebarContext('available', true));
    const scene = notebook();
    const { user } = render(<NotebookEditToggle notebook={scene} />);
    await user.click(composerOption()!);

    expect(assistant).toHaveBeenCalledTimes(1);
    expect(assistant).toHaveBeenCalledWith(TARGET);
    expect(scene.state.isComposing).toBeFalsy();
  });

  it('ends a request Assistant has not acted on when the notebook goes away', async () => {
    const scene = new NotebookScene({
      title: 'Leaving',
      uid: 'nb-toggle',
      body: new NotebookLayoutManager({ cells: [] }),
      $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
      timePicker: new SceneTimePicker({}),
      refreshPicker: new SceneRefreshPicker({}),
    });
    const deactivate = scene.activate();
    cleanups.push(setRouteNotebook(scene));
    const { user } = render(<NotebookEditToggle notebook={scene} />);
    await user.click(composerOption()!);
    expect(sidebarPresentation()).toBe('floating');

    act(() => deactivate());

    expect(getPendingComposerEnterTarget()).toBeUndefined();
    expect(sidebarPresentation()).toBe('docked');
  });

  it('selects Composer when Assistant enters it by other means', () => {
    const scene = notebook();
    render(<NotebookEditToggle notebook={scene} />);
    expect(radio('View')).toBeChecked();

    act(() => {
      enterNotebookComposer(scene);
    });

    expect(composerOption()).toBeChecked();
  });

  it.each([
    ['View', false],
    ['Edit', true],
  ])('ends the session from Composer and lands in %s', async (name, editing) => {
    const scene = notebook();
    const session = enterNotebookComposer(scene);
    const { user } = render(<NotebookEditToggle notebook={scene} />);
    expect(composerOption()).toBeChecked();

    await user.click(radio(name)!);

    expect(session.signal.aborted).toBe(true);
    expect(scene.state.isComposing).toBe(false);
    expect(Boolean(scene.state.isEditing)).toBe(editing);
    expect(radio(name)).toBeChecked();
  });
});
