import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import yaml from 'js-yaml';
import { TestProvider } from 'test/helpers/TestProvider';
import { render as renderApp } from 'test/test-utils';

import { config, locationService } from '@grafana/runtime';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { contextSrv } from 'app/core/services/context_srv';
import {
  createDashboardMutationApi,
  setDashboardMutationClientForTests,
} from 'app/features/plugins/components/restrictedGrafanaApis/dashboardMutation/dashboardMutationApi';

import { applyDashboardSpec } from '../actions/dashboard/applyDashboardSpec';
import { DashboardMutationClient } from '../mutation-api/DashboardMutationClient';
import { DashboardPrompt } from '../saving/DashboardPrompt';
import { SaveDashboardDrawer } from '../saving/SaveDashboardDrawer';
import { setDashboardModeAfterSave, consumeDashboardModeAfterSave } from '../saving/editPresentationAfterSave';
import { buildDashboardWithAccessInfoFromScene } from '../serialization/buildDashboardWithAccessInfoFromScene';
import { transformSaveModelSchemaV2ToScene } from '../serialization/transformSaveModelSchemaV2ToScene';
import { transformSaveModelToScene } from '../serialization/transformSaveModelToScene';
import { DashboardSidebarSplitter } from '../sidebar/DashboardSidebarSplitter';
import { getDashboardResourceText } from '../sidebar/codePaneUtils';
import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';

import { DashboardModePicker } from './DashboardModePicker';
import { toggleVizPanelLegend } from './PanelMenuBehavior';
import { dashboardModesEnabled, getDashboardMode, canManuallyEditDashboard } from './dashboardModes';
import { SaveDashboard } from './new-toolbar/actions/SaveDashboard';
import { isFullDashboardEditing } from './types/dashboard';

jest.mock('../saving/createDetectChangesWorker', () => ({
  createWorker: () => ({ postMessage: jest.fn(), terminate: jest.fn(), onmessage: null }),
}));

// Monaco needs browser APIs unavailable in jsdom; keep the schema editor and pane real.
jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  ReactMonacoDiffEditor: ({
    original,
    modified,
    options,
  }: {
    original: string;
    modified: string;
    options: { renderSideBySide: boolean };
  }) => (
    <div role="region" aria-label={options.renderSideBySide ? 'Side by side comparison' : 'Inline comparison'}>
      <textarea aria-label="Current dashboard JSON" value={original} readOnly />
      <textarea aria-label="Pending code JSON" value={modified} readOnly />
    </div>
  ),
  CodeEditor: ({
    value,
    onChange,
    language,
  }: {
    value: string;
    onChange: (value: string) => void;
    language: string;
  }) => (
    <textarea
      aria-label={language === 'yaml' ? 'Dashboard YAML' : 'Dashboard JSON'}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

// The YAML editor validates through a hidden Monaco model; jsdom has no editor workers.
jest.mock('monaco-editor', () => ({
  Uri: { parse: (uri: string) => uri },
  editor: {
    createModel: (_value: string, _language: string, uri: string) => ({ uri, dispose: jest.fn() }),
    getModelMarkers: () => [],
  },
  languages: { json: { jsonDefaults: { setDiagnosticsOptions: jest.fn() } } },
  MarkerSeverity: { Error: 8 },
}));

jest.mock('../v2schema/dashboardSchemaFetcher', () => ({
  fetchDashboardSchema: jest.fn().mockResolvedValue({}),
}));

const originalLayouts = config.featureToggles.dashboardNewLayouts;
let deactivate = () => {};

beforeEach(() => {
  config.featureToggles.dashboardNewLayouts = true;
  setTestFlags({ 'grafana.dashboardPreviewMode': true });
  locationService.replace('/d/modes-test');
});

afterEach(() => {
  cleanup();
  setDashboardMutationClientForTests(null);
  deactivate();
  deactivate = () => {};
  config.featureToggles.dashboardNewLayouts = originalLayouts;
  setTestFlags({});
});

function setup(withPanel = false) {
  const scene = transformSaveModelToScene({
    dashboard: {
      title: 'Original title',
      uid: 'modes-test',
      version: 1,
      schemaVersion: 39,
      panels: withPanel
        ? [
            {
              id: 1,
              type: 'text',
              title: 'Notes',
              gridPos: { x: 0, y: 0, w: 12, h: 8 },
              options: { mode: 'markdown', content: 'Keep this text' },
              fieldConfig: { defaults: {}, overrides: [] },
            },
          ]
        : [],
      annotations: {
        list: [
          {
            builtIn: 1,
            iconColor: 'rgba(0, 211, 255, 1)',
            enable: false,
            hide: true,
            name: 'Annotations & Alerts',
            type: 'dashboard',
            datasource: { uid: '-- Grafana --', type: 'grafana' },
          },
        ],
      },
    },
    meta: { canEdit: true, canSave: true },
  });
  deactivate = scene.activate();
  return scene;
}

function editCode(scene: ReturnType<typeof setup>, title: string) {
  const session = scene.state.codeSession!;
  const resource = JSON.parse(session.state.text);
  resource.spec.title = title;
  session.updateText(JSON.stringify(resource, null, 2));
}

it.each([
  [false, false, false],
  [false, true, false],
  [true, false, false],
  [true, true, true],
])('gates modes with layouts=%s and preview=%s', (layouts, preview, expected) => {
  config.featureToggles.dashboardNewLayouts = layouts;
  setTestFlags({ 'grafana.dashboardPreviewMode': preview });
  expect(dashboardModesEnabled()).toBe(expected);
});

it('keeps the draft and history when switching modes without additional edits', () => {
  const scene = setup();
  expect(getDashboardMode(scene.state)).toBe('view');
  scene.setDashboardMode('edit');
  const resource = JSON.parse(getDashboardResourceText(scene));
  resource.spec.title = 'Visual edit';
  applyDashboardSpec({ scene, spec: resource.spec, description: 'Change title' });
  expect(scene.state.title).toBe('Visual edit');
  expect(scene.state.sidebar.state.undoStack).toHaveLength(1);
  const baseline = scene.getInitialState()?.title;
  scene.setDashboardMode('view');
  expect(isFullDashboardEditing(scene.state)).toBe(false);
  expect(scene.state.isEditing).toBe(true);
  scene.setDashboardMode('code');
  scene.setDashboardMode('edit');
  expect(scene.state.title).toBe('Visual edit');
  expect(scene.state.sidebar.state.undoStack).toHaveLength(1);
  expect(scene.getInitialState()?.title).toBe(baseline);
});

it('applies code once, then undoes without restoring Code mode', () => {
  const scene = setup();
  scene.setDashboardMode('code');
  editCode(scene, 'Code title');
  expect(scene.setDashboardMode('view')).toBe(true);
  expect(scene.state.title).toBe('Code title');
  expect(scene.state.sidebar.state.undoStack).toHaveLength(1);
  scene.state.sidebar.undoAction();
  expect(scene.state.title).toBe('Code title');
  scene.setDashboardMode('edit');
  scene.state.sidebar.undoAction();
  expect(scene.state.title).toBe('Original title');
  expect(getDashboardMode(scene.state)).toBe('edit');
  scene.state.sidebar.redoAction();
  expect(scene.state.title).toBe('Code title');
  expect(getDashboardMode(scene.state)).toBe('edit');
});

it('keeps invalid text and refuses switching and saving', async () => {
  const scene = setup();
  scene.setDashboardMode('code');
  scene.state.codeSession!.updateText('{ unfinished');
  expect(scene.setDashboardMode('view')).toBe(false);
  await scene.openSaveDrawer({});
  expect(getDashboardMode(scene.state)).toBe('code');
  expect(scene.state.codeSession!.state.text).toBe('{ unfinished');
  expect(scene.state.codeSession!.state.error).toEqual(expect.any(String));
  expect(scene.state.title).toBe('Original title');
  expect(scene.state.overlay).toBeUndefined();
});

it('rejects code that would silently drop an unsupported field', () => {
  const scene = setup();
  scene.setDashboardMode('code');
  const resource = JSON.parse(scene.state.codeSession!.state.text);
  resource.spec.futureField = 'keep me';
  scene.state.codeSession!.updateText(JSON.stringify(resource));
  expect(scene.setDashboardMode('edit')).toBe(false);
  expect(scene.state.codeSession!.state.error).toContain('spec.futureField');
  expect(scene.state.title).toBe('Original title');
});

it('detects concurrent changes and preserves pending code', () => {
  const scene = setup();
  scene.setDashboardMode('code');
  editCode(scene, 'My code');
  scene.setState({ title: 'Assistant title' });
  expect(scene.setDashboardMode('view')).toBe(false);
  expect(scene.state.codeSession!.state.error).toContain('dashboard changed');
  expect(JSON.parse(scene.state.codeSession!.state.text).spec.title).toBe('My code');
  expect(scene.state.title).toBe('Assistant title');
});

it('discards pending code and dashboard changes while keeping the selected mode', () => {
  const scene = setup();
  scene.setDashboardMode('edit');
  scene.setState({ title: 'Visual title' });
  scene.setDashboardMode('code');
  editCode(scene, 'Pending title');
  scene.discardChangesAndKeepEditing();
  expect(scene.state.title).toBe('Original title');
  expect(getDashboardMode(scene.state)).toBe('code');
  expect(JSON.parse(scene.state.codeSession!.state.text).spec.title).toBe('Original title');
  expect(scene.hasPendingCodeChanges()).toBe(false);
});

it('accepts Assistant writes in View and refuses generic plugin writes', async () => {
  const scene = setup();
  const client = new DashboardMutationClient(scene);
  const spec = JSON.parse(getDashboardResourceText(scene)).spec;
  spec.title = 'Assistant title';
  const mutation = { type: 'APPLY_SPEC', payload: { spec, validate: true } };
  expect((await client.execute(mutation, 'another-app')).success).toBe(false);
  expect(scene.state.title).toBe('Original title');
  expect((await client.execute(mutation, 'grafana-assistant-app')).success).toBe(true);
  expect(scene.state.title).toBe('Assistant title');
  expect(getDashboardMode(scene.state)).toBe('view');
  expect(canManuallyEditDashboard(scene.state)).toBe(false);
  expect((await client.execute({ type: 'GET_SPEC', payload: {} }, 'another-app')).success).toBe(true);
});

it('refuses Assistant writes without edit permission', async () => {
  const scene = setup();
  scene.setState({ meta: { canEdit: false, canSave: false } });
  const result = await new DashboardMutationClient(scene).execute(
    {
      type: 'APPLY_SPEC',
      payload: { spec: JSON.parse(getDashboardResourceText(scene)).spec },
    },
    'grafana-assistant-app'
  );
  expect(result.success).toBe(false);
  expect(scene.state.title).toBe('Original title');
});

it('blocks direct edit actions and settings from View', () => {
  const scene = setup();
  scene.onEnterEditMode('assistant');
  const spec = JSON.parse(getDashboardResourceText(scene)).spec;
  spec.title = 'Hidden action';
  applyDashboardSpec({ scene, spec, description: 'Manual change' });
  scene.onOpenSettings();
  expect(scene.state.title).toBe('Original title');
  expect(scene.state.sidebar.state.undoStack).toHaveLength(0);
  expect(getDashboardMode(scene.state)).toBe('view');
});

it.each(['label', 'caret'])('opens the mode picker from the %s and switches the editing policy', async (trigger) => {
  const scene = setup();
  render(
    <TestProvider>
      <DashboardModePicker dashboard={scene} />
    </TestProvider>
  );
  const user = userEvent.setup();
  const buttonName = (mode: string) => (trigger === 'label' ? `Dashboard mode: ${mode}` : 'Change dashboard mode');
  await user.click(screen.getByRole('button', { name: buttonName('View') }));
  expect(screen.getByRole('menuitemradio', { name: /View/ })).toBeChecked();
  expect(screen.getByText('View and explore the dashboard.')).toBeInTheDocument();
  await user.click(screen.getByRole('menuitemradio', { name: /Manually edit panels/ }));
  expect(screen.getByRole('button', { name: buttonName('Edit') })).toHaveAttribute('aria-expanded', 'false');
  await user.click(screen.getByRole('button', { name: buttonName('Edit') }));
  expect(screen.getByRole('menuitemradio', { name: /Manually edit panels/ })).toBeChecked();
  await user.keyboard('{Escape}');
  expect(screen.getByRole('button', { name: buttonName('Edit') })).toHaveFocus();
  expect(isFullDashboardEditing(scene.state)).toBe(true);
});

it('protects invalid code on browser unload even when the scene is clean', () => {
  const scene = setup();
  act(() => scene.setDashboardMode('code'));
  scene.state.codeSession!.updateText('{');
  render(
    <TestProvider>
      <DashboardPrompt dashboard={scene} />
    </TestProvider>
  );
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
});

it.each(['view', 'edit', 'code'] as const)('hands off %s once after first save or copy', (mode) => {
  setDashboardModeAfterSave('new-uid', mode);
  expect(consumeDashboardModeAfterSave('new-uid')).toBe(mode);
  expect(consumeDashboardModeAfterSave('new-uid')).toBeUndefined();
});

it('binds View mutation permission to the host-provided plugin identity', async () => {
  const scene = setup();
  setDashboardMutationClientForTests(new DashboardMutationClient(scene));
  const spec = JSON.parse(getDashboardResourceText(scene)).spec;
  spec.title = 'Assistant edit in View';
  const mutation = { type: 'APPLY_SPEC', payload: { spec } };
  const untrusted = await createDashboardMutationApi('other-app').execute(mutation);
  expect(untrusted.success).toBe(false);
  expect(scene.state.title).toBe('Original title');
  const assistant = await createDashboardMutationApi('grafana-assistant-app').execute(mutation);
  expect(assistant.success).toBe(true);
  expect(scene.state.title).toBe('Assistant edit in View');
  expect(getDashboardMode(scene.state)).toBe('view');
});

it.each(['GridLayout', 'AutoGridLayout', 'RowsLayout', 'TabsLayout'])(
  'round-trips panels and %s through Code and View',
  (kind) => {
    const scene = setup(true);
    scene.setDashboardMode('code');
    const resource = JSON.parse(scene.state.codeSession!.state.text);
    const grid = resource.spec.layout;
    if (kind === 'AutoGridLayout') {
      resource.spec.layout = {
        kind,
        spec: {
          columnWidthMode: 'standard',
          rowHeightMode: 'standard',
          maxColumnCount: 3,
          items: [{ kind: 'AutoGridLayoutItem', spec: { element: { kind: 'ElementReference', name: 'panel-1' } } }],
        },
      };
    } else if (kind === 'RowsLayout') {
      resource.spec.layout = {
        kind,
        spec: { rows: [{ kind: 'RowsLayoutRow', spec: { title: 'Row', collapse: false, layout: grid } }] },
      };
    } else if (kind === 'TabsLayout') {
      resource.spec.layout = {
        kind,
        spec: { tabs: [{ kind: 'TabsLayoutTab', spec: { title: 'Tab', layout: grid } }] },
      };
    }
    resource.spec.title = 'Edited in Code';
    scene.state.codeSession!.updateText(JSON.stringify(resource));
    expect(scene.setDashboardMode('view')).toBe(true);
    expect(scene.state.title).toBe('Edited in Code');
    const saved = JSON.parse(getDashboardResourceText(scene)).spec;
    expect(saved.layout.kind).toBe(kind);
    expect(saved.elements['panel-1'].spec.vizConfig.spec.options).toEqual({
      mode: 'markdown',
      content: 'Keep this text',
    });
    scene.setDashboardMode('edit');
    scene.state.sidebar.undoAction();
    expect(scene.state.title).toBe('Original title');
    expect(JSON.parse(getDashboardResourceText(scene)).spec.layout).toEqual(grid);
  }
);

it('blocks the legend shortcut from changing panel options in View', () => {
  const scene = setup(true);
  const panel = dashboardSceneGraph.getVizPanels(scene)[0];
  panel.setState({ options: { legend: { showLegend: true } } });
  const changeOptions = jest.spyOn(panel, 'onOptionsChange').mockImplementation(() => {});
  toggleVizPanelLegend(panel);
  expect(changeOptions).not.toHaveBeenCalled();
  expect(panel.state.options).toEqual({ legend: { showLegend: true } });
  scene.setDashboardMode('edit');
  toggleVizPanelLegend(panel);
  expect(changeOptions).toHaveBeenCalledWith({ legend: { showLegend: false } });
});

it('preserves an explicitly empty description so a saved copy stays clean', () => {
  const scene = setup();
  scene.setDashboardMode('code');
  const resource = JSON.parse(scene.state.codeSession!.state.text);
  resource.spec.description = '';
  scene.state.codeSession!.updateText(JSON.stringify(resource));
  expect(scene.setDashboardMode('view')).toBe(true);
  expect(JSON.parse(getDashboardResourceText(scene)).spec.description).toBe('');
  scene.setDashboardMode('code');
  scene.setDashboardMode('view');
  expect(JSON.parse(getDashboardResourceText(scene)).spec.description).toBe('');
});

it('keeps dashboard content visible while applying JSON from the bottom pane without leaving Code mode', async () => {
  const scene = setup();
  scene.setDashboardMode('code');
  function Dashboard() {
    const { title } = scene.useState();
    return <DashboardSidebarSplitter dashboard={scene} body={<h2>{title}</h2>} />;
  }
  renderApp(<Dashboard />);
  const editor = await screen.findByRole('textbox', { name: 'Dashboard JSON' });
  expect(screen.getByRole('heading', { name: 'Original title' })).toBeInTheDocument();
  expect(screen.getByRole('separator', { name: 'Resize dashboard and code editor' })).toHaveAttribute(
    'aria-orientation',
    'horizontal'
  );
  const resource = JSON.parse(scene.state.codeSession!.state.text);
  resource.spec.title = 'Updated from code';
  fireEvent.change(editor, { target: { value: JSON.stringify(resource) } });
  await userEvent.click(screen.getByRole('button', { name: 'Apply changes' }));
  expect(await screen.findByRole('heading', { name: 'Updated from code' })).toBeInTheDocument();
  expect(getDashboardMode(scene.state)).toBe('code');
  expect(screen.getByRole('button', { name: 'Apply changes' })).toBeDisabled();
  expect(scene.state.sidebar.state.undoStack).toHaveLength(1);

  fireEvent.change(editor, { target: { value: '{ invalid' } });
  await userEvent.click(screen.getByRole('button', { name: 'Apply changes' }));
  expect(screen.getByRole('button', { name: 'Apply changes' })).toBeDisabled();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Updated from code' })).toBeInTheDocument();
  expect(editor).toHaveValue('{ invalid');
});

it.each(['JSON', 'YAML'])('collapses and reopens the code pane without losing pending %s', async (format) => {
  const scene = setup();
  scene.setDashboardMode('code');
  renderApp(<DashboardSidebarSplitter dashboard={scene} body={<h2>Dashboard preview</h2>} />);
  await screen.findByRole('textbox', { name: 'Dashboard JSON' });
  await userEvent.click(screen.getByRole('radio', { name: format }));
  const editor = screen.getByRole('textbox', { name: `Dashboard ${format}` });
  fireEvent.change(editor, { target: { value: '{ unfinished JSON' } });

  const splitter = screen.getByRole('separator', { name: 'Resize dashboard and code editor' });
  const container = splitter.parentElement!;
  const primaryPane = document.getElementById(splitter.getAttribute('aria-controls')!)!;
  // jsdom has no layout; give the real splitter a 600px area with two equal panes.
  jest.spyOn(container, 'getBoundingClientRect').mockReturnValue({
    ...container.getBoundingClientRect(),
    height: 600,
  });
  jest.spyOn(primaryPane, 'getBoundingClientRect').mockReturnValue({
    ...primaryPane.getBoundingClientRect(),
    height: 300,
  });
  splitter.setPointerCapture = jest.fn();
  splitter.releasePointerCapture = jest.fn();
  await userEvent.pointer([
    { keys: '[MouseLeft>]', target: splitter, coords: { clientY: 300 } },
    { target: splitter, coords: { clientY: 550 } },
    { keys: '[/MouseLeft]', target: splitter },
  ]);

  const reopen = screen.getByRole('button', { name: 'Open code pane' });
  expect(screen.getByRole('heading', { name: 'Dashboard preview' })).toBeVisible();
  expect(screen.queryByRole('textbox', { name: `Dashboard ${format}` })).not.toBeInTheDocument();
  await userEvent.click(reopen);
  expect(await screen.findByRole('textbox', { name: `Dashboard ${format}` })).toHaveValue('{ unfinished JSON');
  expect(getDashboardMode(scene.state)).toBe('code');
});

it('merges non-overlapping Assistant updates before applying pending code', () => {
  const scene = setup();
  scene.setDashboardMode('code');
  editCode(scene, 'My title');
  scene.setState({ description: 'Assistant description' });
  const session = scene.state.codeSession!;
  session.sync(scene);
  expect(JSON.parse(session.state.text).spec).toMatchObject({
    title: 'My title',
    description: 'Assistant description',
  });
  expect(scene.state.title).toBe('Original title');
  expect(scene.setDashboardMode('view')).toBe(true);
  expect(scene.state.title).toBe('My title');
  expect(scene.state.description).toBe('Assistant description');
});

it('keeps invalid code through multiple incoming updates and merges once the JSON is fixed', () => {
  const scene = setup();
  scene.setDashboardMode('code');
  const session = scene.state.codeSession!;
  const original = JSON.parse(session.state.text);
  session.updateText('{ unfinished');
  scene.setState({ description: 'First' });
  session.sync(scene);
  scene.setState({ description: 'Latest' });
  session.sync(scene);
  expect(session.state.text).toBe('{ unfinished');
  expect(JSON.parse(session.state.incoming!).spec.description).toBe('Latest');
  original.spec.title = 'Mine';
  session.updateText(JSON.stringify(original));
  expect(JSON.parse(session.state.text).spec).toMatchObject({ title: 'Mine', description: 'Latest' });
  expect(session.state.incoming).toBeUndefined();
});

it('invalidates review choices if another dashboard update arrives before confirmation', () => {
  const scene = setup();
  scene.setDashboardMode('code');
  const session = scene.state.codeSession!;
  editCode(scene, 'Mine');
  scene.setState({ title: 'Assistant one' });
  session.sync(scene);
  session.chooseResolution('/spec/title', 'local');
  scene.setState({ title: 'Assistant two' });
  expect(session.finishReview(scene)).toBe(false);
  expect(session.state.resolutions).toEqual({});
  expect(session.state.conflicts).toEqual([
    { path: '/spec/title', base: 'Original title', local: 'Mine', incoming: 'Assistant two' },
  ]);
  session.chooseResolution('/spec/title', 'incoming');
  expect(session.finishReview(scene)).toBe(true);
  expect(JSON.parse(session.state.text).spec.title).toBe('Assistant two');
  expect(session.hasChanges()).toBe(false);
});

it('syncs the editor automatically and reviews overlapping changes before applying', async () => {
  const scene = setup();
  scene.setDashboardMode('code');
  function Dashboard() {
    const { title } = scene.useState();
    return <DashboardSidebarSplitter dashboard={scene} body={<h2>{title}</h2>} />;
  }
  renderApp(<Dashboard />);
  const editor = await screen.findByRole('textbox', { name: 'Dashboard JSON' });
  await act(async () => scene.setState({ title: 'Assistant first' }));
  expect(JSON.parse(scene.state.codeSession!.state.text).spec.title).toBe('Assistant first');
  expect(editor).toHaveValue(scene.state.codeSession!.state.text);
  const resource = JSON.parse(scene.state.codeSession!.state.text);
  resource.spec.title = 'My title';
  fireEvent.change(editor, { target: { value: JSON.stringify(resource) } });
  await act(async () => {
    const spec = JSON.parse(getDashboardResourceText(scene)).spec;
    spec.title = 'Assistant second';
    spec.description = 'Keep this addition';
    const result = await new DashboardMutationClient(scene).execute(
      { type: 'APPLY_SPEC', payload: { spec, validate: true } },
      'grafana-assistant-app'
    );
    expect(result.success).toBe(true);
  });
  expect(screen.getByRole('heading', { name: 'Assistant second' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Apply changes' })).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: 'More apply options' }));
  expect(screen.getByRole('menuitem', { name: 'Apply changes and Save' })).toBeDisabled();
  expect(screen.getByRole('menuitem', { name: 'Save as copy' })).toBeDisabled();
  await userEvent.keyboard('{Escape}');
  await userEvent.click(screen.getByRole('button', { name: 'Review changes' }));
  expect(screen.getByText('"Assistant first"')).toBeInTheDocument();
  expect(screen.getByText('"My title"')).toBeInTheDocument();
  expect(screen.getByText('"Assistant second"')).toBeInTheDocument();
  expect(
    within(screen.getByRole('group', { name: 'Dashboard code actions' })).getByRole('button', {
      name: 'Use resolved code',
    })
  ).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: 'Keep mine for /spec/title' }));
  await userEvent.click(screen.getByRole('button', { name: 'Use resolved code' }));
  expect(screen.getByRole('heading', { name: 'Assistant second' })).toBeInTheDocument();
  expect(JSON.parse(scene.state.codeSession!.state.text).spec).toMatchObject({
    title: 'My title',
    description: 'Keep this addition',
  });
  await userEvent.click(screen.getByRole('button', { name: 'Apply changes' }));
  expect(screen.getByRole('heading', { name: 'My title' })).toBeInTheDocument();
  expect(scene.state.description).toBe('Keep this addition');
  expect(getDashboardMode(scene.state)).toBe('code');
  expect(screen.queryByRole('button', { name: 'Reload dashboard code' })).not.toBeInTheDocument();
});

it('does not mark automatically synced additions as pending code edits', () => {
  const scene = setup();
  scene.setDashboardMode('code');
  scene.setState({ description: 'New description from Assistant' });
  const session = scene.state.codeSession!;
  session.sync(scene);
  expect(JSON.parse(session.state.text).spec.description).toBe('New description from Assistant');
  expect(session.hasChanges()).toBe(false);
});

it('switches diff layouts from the unified toolbar and keeps edits when returning to the editor', async () => {
  const scene = setup();
  scene.setDashboardMode('code');
  function Dashboard() {
    const { title } = scene.useState();
    return <DashboardSidebarSplitter dashboard={scene} body={<h2>{title}</h2>} />;
  }
  renderApp(<Dashboard />);
  const editor = await screen.findByRole('textbox', { name: 'Dashboard JSON' });
  const resource = JSON.parse(scene.state.codeSession!.state.text);
  resource.spec.title = 'Pending title';
  const pendingText = JSON.stringify(resource);
  fireEvent.change(editor, { target: { value: pendingText } });
  const toolbar = screen.getByRole('group', { name: 'Dashboard code actions' });
  const actions = within(toolbar);
  expect(toolbar.compareDocumentPosition(editor) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(actions.getByRole('switch', { name: 'Show diff' })).not.toBeChecked();
  expect(actions.queryByRole('radio', { name: 'Inline' })).not.toBeInTheDocument();
  await userEvent.click(actions.getByRole('switch', { name: 'Show diff' }));
  expect(actions.getByRole('switch', { name: 'Show diff' })).toBeChecked();
  await userEvent.click(actions.getByRole('radio', { name: 'Inline' }));
  expect(screen.getByRole('region', { name: 'Inline comparison' })).toBeInTheDocument();
  await userEvent.click(actions.getByRole('radio', { name: 'Side by side' }));
  expect(screen.getByRole('region', { name: 'Side by side comparison' })).toBeInTheDocument();
  expect(
    JSON.parse((screen.getByRole('textbox', { name: 'Current dashboard JSON' }) as HTMLTextAreaElement).value).spec
      .title
  ).toBe('Original title');
  expect(
    JSON.parse((screen.getByRole('textbox', { name: 'Pending code JSON' }) as HTMLTextAreaElement).value).spec.title
  ).toBe('Pending title');
  expect(screen.queryByText('Dashboard JSON')).not.toBeInTheDocument();
  await userEvent.click(actions.getByRole('switch', { name: 'Show diff' }));
  expect(actions.queryByRole('radio', { name: 'Side by side' })).not.toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Dashboard JSON' })).toHaveValue(pendingText);
  await userEvent.click(actions.getByRole('button', { name: 'Apply changes' }));
  expect(screen.getByRole('heading', { name: 'Pending title' })).toBeInTheDocument();
});

it('shows unsaved Assistant and code changes against the saved dashboard', async () => {
  const scene = setup();
  const spec = JSON.parse(getDashboardResourceText(scene)).spec;
  spec.title = 'Assistant title';
  const result = await new DashboardMutationClient(scene).execute(
    { type: 'APPLY_SPEC', payload: { spec, validate: true } },
    'grafana-assistant-app'
  );
  expect(result.success).toBe(true);
  scene.setDashboardMode('code');
  renderApp(<DashboardSidebarSplitter dashboard={scene} body={<h2>{scene.state.title}</h2>} />);
  const editor = await screen.findByRole('textbox', { name: 'Dashboard JSON' });
  expect(JSON.parse((editor as HTMLTextAreaElement).value).spec.title).toBe('Assistant title');
  await userEvent.click(screen.getByRole('switch', { name: 'Show diff' }));
  expect(
    JSON.parse((screen.getByRole('textbox', { name: 'Current dashboard JSON' }) as HTMLTextAreaElement).value).spec
      .title
  ).toBe('Original title');
  expect(
    JSON.parse((screen.getByRole('textbox', { name: 'Pending code JSON' }) as HTMLTextAreaElement).value).spec.title
  ).toBe('Assistant title');
  expect(screen.getByRole('button', { name: 'Apply changes' })).toBeDisabled();

  await userEvent.click(screen.getByRole('switch', { name: 'Show diff' }));
  const resource = JSON.parse(scene.state.codeSession!.state.text);
  resource.spec.description = 'Code description';
  fireEvent.change(screen.getByRole('textbox', { name: 'Dashboard JSON' }), {
    target: { value: JSON.stringify(resource) },
  });
  await userEvent.click(screen.getByRole('button', { name: 'Apply changes' }));
  expect(scene.state.description).toBe('Code description');
  await userEvent.click(screen.getByRole('switch', { name: 'Show diff' }));
  expect(
    JSON.parse((screen.getByRole('textbox', { name: 'Current dashboard JSON' }) as HTMLTextAreaElement).value).spec
      .title
  ).toBe('Original title');
  expect(
    JSON.parse((screen.getByRole('textbox', { name: 'Pending code JSON' }) as HTMLTextAreaElement).value).spec
  ).toMatchObject({ title: 'Assistant title', description: 'Code description' });

  await act(async () => {
    await scene.saveCompleted(scene.getSaveModel(), {
      uid: 'modes-test',
      version: 2,
      url: '/d/modes-test',
      status: 'success',
      slug: 'modes-test',
    });
  });
  expect(
    JSON.parse((screen.getByRole('textbox', { name: 'Current dashboard JSON' }) as HTMLTextAreaElement).value).spec
  ).toMatchObject({ title: 'Assistant title', description: 'Code description' });
});

it.each(['syntax', 'schema', 'envelope', 'unsupported'])(
  'disables Apply for %s errors until the JSON is corrected',
  async (kind) => {
    const scene = setup();
    scene.setDashboardMode('code');
    renderApp(<DashboardSidebarSplitter dashboard={scene} body={<h2>{scene.state.title}</h2>} />);
    const editor = await screen.findByRole('textbox', { name: 'Dashboard JSON' });
    const resource = JSON.parse(scene.state.codeSession!.state.text);
    resource.spec.title = 'Corrected title';
    const validText = JSON.stringify(resource);
    if (kind === 'schema') {
      resource.spec.title = 123;
    } else if (kind === 'envelope') {
      resource.kind = 'Panel';
    } else if (kind === 'unsupported') {
      resource.spec.futureField = true;
    }
    const invalidText = kind === 'syntax' ? '{ unfinished' : JSON.stringify(resource);
    fireEvent.change(editor, { target: { value: invalidText } });
    expect(screen.getByRole('button', { name: 'Apply changes' })).toBeDisabled();
    await userEvent.click(screen.getByRole('switch', { name: 'Show diff' }));
    expect(screen.getByRole('button', { name: 'Apply changes' })).toBeDisabled();
    expect(scene.state.title).toBe('Original title');
    await userEvent.click(screen.getByRole('button', { name: 'More apply options' }));
    expect(screen.getByRole('menuitem', { name: 'Apply changes and Save' })).toBeDisabled();
    expect(screen.getByRole('menuitem', { name: 'Save as copy' })).toBeDisabled();
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('switch', { name: 'Show diff' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Dashboard JSON' }), { target: { value: validText } });
    expect(screen.getByRole('button', { name: 'Apply changes' })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: 'Apply changes' }));
    expect(scene.state.title).toBe('Corrected title');
  }
);

it('hides toolbar Save in Code mode and blocks both save actions for invalid drafts', async () => {
  const scene = setup();
  scene.setDashboardMode('code');
  function Dashboard() {
    const { title } = scene.useState();
    return (
      <>
        <SaveDashboard dashboard={scene} />
        <DashboardSidebarSplitter dashboard={scene} body={<h2>{title}</h2>} />
      </>
    );
  }
  renderApp(<Dashboard />);
  const editor = await screen.findByRole('textbox', { name: 'Dashboard JSON' });
  expect(screen.getByRole('button', { name: 'Apply changes' })).toBeDisabled();
  expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  const resource = JSON.parse(scene.state.codeSession!.state.text);
  resource.spec.title = 'Applied before saving';
  fireEvent.change(editor, { target: { value: JSON.stringify(resource) } });
  await userEvent.click(screen.getByRole('button', { name: 'Apply changes' }));
  expect(screen.getByRole('heading', { name: 'Applied before saving' })).toBeInTheDocument();
  expect(scene.state.overlay).toBeUndefined();
  await userEvent.click(screen.getByRole('button', { name: 'More apply options' }));
  expect(screen.getByRole('menuitem', { name: 'Apply changes and Save' })).toBeEnabled();
  await userEvent.keyboard('{Escape}');
  fireEvent.change(editor, { target: { value: '{ invalid again' } });
  await userEvent.click(screen.getByRole('button', { name: 'More apply options' }));
  expect(screen.getByRole('menuitem', { name: 'Apply changes and Save' })).toBeDisabled();
  expect(screen.getByRole('menuitem', { name: 'Save as copy' })).toBeDisabled();
  await userEvent.click(screen.getByRole('menuitem', { name: 'Apply changes and Save' }));
  expect(scene.state.overlay).toBeUndefined();
});

it.each([
  { action: 'Apply changes and Save', copy: false },
  { action: 'Save as copy', copy: true },
])('applies pending code before opening the normal $action drawer', async ({ action, copy }) => {
  const scene = setup();
  scene.setDashboardMode('code');
  renderApp(<DashboardSidebarSplitter dashboard={scene} body={<h2>Preview</h2>} />);
  const editor = await screen.findByRole('textbox', { name: 'Dashboard JSON' });
  const resource = JSON.parse(scene.state.codeSession!.state.text);
  resource.spec.title = 'Code ready to save';
  fireEvent.change(editor, { target: { value: JSON.stringify(resource) } });
  await userEvent.click(screen.getByRole('button', { name: 'More apply options' }));
  await userEvent.click(screen.getByRole('menuitem', { name: action }));
  await waitFor(() => expect(scene.state.overlay).toBeInstanceOf(SaveDashboardDrawer));
  const drawer = scene.state.overlay as SaveDashboardDrawer;
  expect(drawer.state.dashboardRef.resolve().state.title).toBe('Code ready to save');
  expect(Boolean(drawer.state.saveAsCopy)).toBe(copy);
  expect(scene.hasPendingCodeChanges()).toBe(false);
  expect(getDashboardMode(scene.state)).toBe('code');
});

it.each(['new', 'template', 'copy-only', 'no-save-permission'] as const)(
  'uses the toolbar save policy for a %s dashboard in Code mode',
  async (kind) => {
    const previousFolderPermission = contextSrv.hasEditPermissionInFolders;
    contextSrv.hasEditPermissionInFolders = kind === 'copy-only';
    try {
      const scene = setup();
      if (kind === 'new') {
        scene.setState({ uid: undefined });
      } else if (kind === 'template') {
        setTestFlags({ 'grafana.dashboardPreviewMode': true, 'grafana.customDashboardTemplates': true });
        scene.setState({ meta: { ...scene.state.meta, isDashboardTemplate: true } });
      } else {
        scene.setState({ meta: { ...scene.state.meta, canSave: false, canMakeEditable: false } });
      }
      scene.setDashboardMode('code');
      renderApp(<DashboardSidebarSplitter dashboard={scene} body={<h2>Preview</h2>} />);
      const editor = await screen.findByRole('textbox', { name: 'Dashboard JSON' });
      const resource = JSON.parse(scene.state.codeSession!.state.text);
      resource.spec.title = 'Saved from code';
      fireEvent.change(editor, { target: { value: JSON.stringify(resource) } });
      expect(screen.getByRole('button', { name: 'Apply changes' })).toBeEnabled();
      if (kind === 'no-save-permission') {
        expect(screen.queryByRole('button', { name: 'More apply options' })).not.toBeInTheDocument();
        return;
      }
      await userEvent.click(screen.getByRole('button', { name: 'More apply options' }));
      const action = kind === 'copy-only' ? 'Save as copy' : 'Apply changes and Save';
      expect(screen.getAllByRole('menuitem')).toHaveLength(1);
      await userEvent.click(screen.getByRole('menuitem', { name: action }));
      await waitFor(() => expect(scene.state.overlay).toBeInstanceOf(SaveDashboardDrawer));
      const drawer = scene.state.overlay as SaveDashboardDrawer;
      expect(drawer.state.dashboardRef.resolve().state.title).toBe('Saved from code');
      expect(Boolean(drawer.state.saveAsCopy)).toBe(kind === 'copy-only');
      expect(Boolean(drawer.state.saveDashboardTemplate)).toBe(kind === 'template');
    } finally {
      contextSrv.hasEditPermissionInFolders = previousFolderPermission;
    }
  }
);

it.each(['{ invalid', 'valid'])('does not implicitly apply %s code when opening Save', async (text) => {
  const scene = setup();
  scene.setDashboardMode('code');
  if (text === 'valid') {
    editCode(scene, 'Not applied');
  } else {
    scene.state.codeSession!.updateText(text);
  }
  await scene.openSaveDrawer({});
  expect(scene.state.title).toBe('Original title');
  expect(scene.hasPendingCodeChanges()).toBe(true);
  expect(scene.state.overlay).toBeUndefined();
});

it('shows line counts outside the buttons only in Diff and keeps them until saving', async () => {
  const loaded = setup();
  deactivate();
  const scene = transformSaveModelSchemaV2ToScene(
    buildDashboardWithAccessInfoFromScene(loaded, JSON.parse(getDashboardResourceText(loaded)).spec)
  );
  deactivate = scene.activate();
  scene.setDashboardMode('code');
  renderApp(<DashboardSidebarSplitter dashboard={scene} body={<h2>Preview</h2>} />);
  const editor = await screen.findByRole('textbox', { name: 'Dashboard JSON' });
  const toolbar = within(screen.getByRole('group', { name: 'Dashboard code actions' }));
  expect(toolbar.getByRole('switch', { name: 'Show diff' })).not.toBeChecked();
  expect(toolbar.queryByText('+0')).not.toBeInTheDocument();

  const resource = JSON.parse(scene.state.codeSession!.state.text);
  resource.spec.description = 'Added line';
  fireEvent.change(editor, { target: { value: JSON.stringify(resource) } });
  resource.spec.title = 'Changed title';
  fireEvent.change(editor, { target: { value: JSON.stringify(resource) } });
  expect(toolbar.queryByText('+2')).not.toBeInTheDocument();
  await userEvent.click(toolbar.getByRole('switch', { name: 'Show diff' }));
  expect(toolbar.getByRole('status', { name: '2 lines added, 1 lines removed' })).toHaveTextContent('+2-1');
  expect(toolbar.getByText('+2').closest('label')).toBeNull();
  await userEvent.click(toolbar.getByRole('button', { name: 'Apply changes' }));
  expect(toolbar.getByText('+2')).toBeInTheDocument();
  expect(toolbar.getByText('-1')).toBeInTheDocument();
  expect(
    JSON.parse((screen.getByRole('textbox', { name: 'Pending code JSON' }) as HTMLTextAreaElement).value).spec
  ).toMatchObject({ title: 'Changed title', description: 'Added line' });
  await act(async () => {
    await scene.saveCompleted(scene.getSaveModel(), {
      uid: 'modes-test',
      version: 2,
      url: '/d/modes-test',
      status: 'success',
      slug: 'modes-test',
    });
  });
  expect(toolbar.getByText('+0')).toBeInTheDocument();
  expect(toolbar.getByText('-0')).toBeInTheDocument();
  await act(async () => {
    const spec = JSON.parse(getDashboardResourceText(scene)).spec;
    spec.title = 'Assistant title';
    await new DashboardMutationClient(scene).execute(
      { type: 'APPLY_SPEC', payload: { spec, validate: true } },
      'grafana-assistant-app'
    );
  });
  expect(toolbar.getByText('+1')).toBeInTheDocument();
  expect(toolbar.getByText('-1')).toBeInTheDocument();
  await userEvent.click(toolbar.getByRole('switch', { name: 'Show diff' }));
  expect(await screen.findByRole('textbox', { name: 'Dashboard JSON' })).toBeInTheDocument();
  expect(toolbar.queryByText('+1')).not.toBeInTheDocument();
  expect(toolbar.queryByText('-1')).not.toBeInTheDocument();
});

it('edits and previews YAML in the shared toolbar, then applies it before saving', async () => {
  const scene = setup();
  scene.setDashboardMode('code');
  function Dashboard() {
    scene.useState();
    return (
      <>
        <SaveDashboard dashboard={scene} />
        <DashboardSidebarSplitter dashboard={scene} body={<h2>Preview</h2>} />
      </>
    );
  }
  renderApp(<Dashboard />);
  await screen.findByRole('textbox', { name: 'Dashboard JSON' });
  const actions = within(screen.getByRole('group', { name: 'Dashboard code actions' }));
  await userEvent.click(actions.getByRole('radio', { name: 'YAML' }));
  const editor = screen.getByRole('textbox', { name: 'Dashboard YAML' });
  const draft = (editor as HTMLTextAreaElement).value.replace('title: Original title', 'title: YAML title');
  fireEvent.change(editor, { target: { value: draft } });
  expect(scene.state.title).toBe('Original title');
  expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  await userEvent.click(actions.getByRole('switch', { name: 'Show diff' }));
  expect(
    yaml.load((screen.getByRole('textbox', { name: 'Pending code JSON' }) as HTMLTextAreaElement).value)
  ).toMatchObject({ spec: { title: 'YAML title' } });
  expect((screen.getByRole('textbox', { name: 'Pending code JSON' }) as HTMLTextAreaElement).value).toContain(
    'title: YAML title'
  );
  await userEvent.click(actions.getByRole('switch', { name: 'Show diff' }));
  expect(screen.getByRole('textbox', { name: 'Dashboard YAML' })).toHaveValue(draft);
  await waitFor(() => expect(actions.getByRole('button', { name: 'Apply changes' })).toBeEnabled());
  await userEvent.click(actions.getByRole('button', { name: 'Apply changes' }));
  expect(scene.state.title).toBe('YAML title');
  expect(scene.hasPendingCodeChanges()).toBe(false);
  await userEvent.click(actions.getByRole('radio', { name: 'JSON' }));
  expect(
    JSON.parse((screen.getByRole('textbox', { name: 'Dashboard JSON' }) as HTMLTextAreaElement).value).spec.title
  ).toBe('YAML title');
});

it('protects invalid YAML from saving and mode switches, and merges Assistant changes after correction', async () => {
  const scene = setup();
  scene.setDashboardMode('code');
  function Dashboard() {
    scene.useState();
    return (
      <>
        <SaveDashboard dashboard={scene} />
        <DashboardSidebarSplitter dashboard={scene} body={<h2>Preview</h2>} />
      </>
    );
  }
  renderApp(<Dashboard />);
  await screen.findByRole('textbox', { name: 'Dashboard JSON' });
  await userEvent.click(screen.getByRole('radio', { name: 'YAML' }));
  const editor = screen.getByRole('textbox', { name: 'Dashboard YAML' });
  const validDraft = (editor as HTMLTextAreaElement).value.replace('title: Original title', 'title: My YAML title');
  fireEvent.change(editor, { target: { value: 'spec: [' } });
  expect(screen.getByRole('button', { name: 'Apply changes' })).toBeDisabled();
  expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  expect(screen.getByRole('radio', { name: 'JSON' })).toBeDisabled();
  expect(screen.getByRole('switch', { name: 'Show diff' })).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: 'More apply options' }));
  expect(screen.getByRole('menuitem', { name: 'Apply changes and Save' })).toBeDisabled();
  expect(screen.getByRole('menuitem', { name: 'Save as copy' })).toBeDisabled();
  await userEvent.keyboard('{Escape}');
  expect(scene.hasPendingCodeChanges()).toBe(true);
  act(() => {
    expect(scene.setDashboardMode('view')).toBe(false);
  });
  await act(async () => scene.setState({ description: 'Assistant addition' }));
  expect(editor).toHaveValue('spec: [');
  fireEvent.change(editor, { target: { value: validDraft } });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Apply changes' })).toBeEnabled());
  expect(yaml.load((editor as HTMLTextAreaElement).value)).toMatchObject({
    spec: { title: 'My YAML title', description: 'Assistant addition' },
  });
  await userEvent.click(screen.getByRole('button', { name: 'Apply changes' }));
  expect(scene.state.title).toBe('My YAML title');
  expect(scene.state.description).toBe('Assistant addition');
});
