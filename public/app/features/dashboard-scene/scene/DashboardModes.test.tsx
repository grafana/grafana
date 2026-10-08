import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestProvider } from 'test/helpers/TestProvider';

import { locationService } from '@grafana/runtime';
import { setTestFlags } from '@grafana/test-utils/unstable';
import {
  createDashboardMutationApi,
  setDashboardMutationClientForTests,
} from 'app/features/plugins/components/restrictedGrafanaApis/dashboardMutation/dashboardMutationApi';

import { applyDashboardSpec } from '../actions/dashboard/applyDashboardSpec';
import { DashboardMutationClient } from '../mutation-api/DashboardMutationClient';
import { setDashboardModeAfterSave, consumeDashboardModeAfterSave } from '../saving/editPresentationAfterSave';
import { transformSaveModelToScene } from '../serialization/transformSaveModelToScene';
import { getDashboardResourceText } from '../sidebar/codePaneUtils';
import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';

import { DashboardModePicker } from './DashboardModePicker';
import { toggleVizPanelLegend } from './PanelMenuBehavior';
import { dashboardModesEnabled, getDashboardMode, canManuallyEditDashboard } from './dashboardModes';
import { isFullDashboardEditing } from './types/dashboard';

jest.mock('../saving/createDetectChangesWorker', () => ({
  createWorker: () => ({ postMessage: jest.fn(), terminate: jest.fn(), onmessage: null }),
}));

let deactivate = () => {};

beforeEach(() => {
  setTestFlags({ dashboardNewLayouts: true, 'grafana.dashboardPreviewMode': true });
  locationService.replace('/d/modes-test');
});

afterEach(() => {
  cleanup();
  setDashboardMutationClientForTests(null);
  deactivate();
  deactivate = () => {};
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

it.each([
  [false, false, false],
  [false, true, false],
  [true, false, false],
  [true, true, true],
])('gates modes with layouts=%s and preview=%s', (layouts, preview, expected) => {
  setTestFlags({ dashboardNewLayouts: layouts, 'grafana.dashboardPreviewMode': preview });
  expect(dashboardModesEnabled()).toBe(expected);
});

it('keeps the draft and history when switching modes without additional edits', () => {
  const scene = setup();
  expect(getDashboardMode(scene.state)).toBe('view');
  scene.setDashboardMode('edit');
  const resource = JSON.parse(getDashboardResourceText(scene));
  resource.spec.title = 'Visual edit';
  applyDashboardSpec({ scene, spec: resource.spec, description: 'Change title', scope: 'dashboard' });
  expect(scene.state.title).toBe('Visual edit');
  expect(scene.state.sidebar.state.undoStack).toHaveLength(1);
  const baseline = scene.getInitialState()?.title;
  scene.setDashboardMode('view');
  expect(isFullDashboardEditing(scene.state)).toBe(false);
  expect(scene.state.isEditing).toBe(true);
  scene.setDashboardMode('edit');
  expect(scene.state.title).toBe('Visual edit');
  expect(scene.state.sidebar.state.undoStack).toHaveLength(1);
  expect(scene.getInitialState()?.title).toBe(baseline);
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
  applyDashboardSpec({ scene, spec, description: 'Manual change', scope: 'dashboard' });
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
  await user.click(screen.getByRole('button', { name: buttonName('Viewing') }));
  expect(screen.getByRole('menuitemradio', { name: /View/ })).toBeChecked();
  expect(screen.getAllByRole('menuitemradio').map((item) => item.textContent)).toEqual([
    'ViewingView and explore the dashboard.',
    'EditingManually edit panels, layout, and settings.',
  ]);
  expect(screen.getByText('View and explore the dashboard.')).toBeInTheDocument();
  await user.click(screen.getByRole('menuitemradio', { name: /Manually edit panels/ }));
  expect(screen.getByRole('button', { name: buttonName('Editing') })).toHaveAttribute('aria-expanded', 'false');
  await user.click(screen.getByRole('button', { name: buttonName('Editing') }));
  expect(screen.getByRole('menuitemradio', { name: /Manually edit panels/ })).toBeChecked();
  await user.keyboard('{Escape}');
  expect(screen.getByRole('button', { name: buttonName('Editing') })).toHaveFocus();
  expect(isFullDashboardEditing(scene.state)).toBe(true);
});

it.each(['view', 'edit'] as const)('hands off %s once after first save or copy', (mode) => {
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

it('discards changes while preserving Viewing mode', () => {
  const scene = setup();
  scene.setDashboardMode('edit');
  scene.setState({ title: 'Unsaved title' });
  scene.setDashboardMode('view');
  scene.discardChangesAndKeepEditing();
  expect(scene.state.title).toBe('Original title');
  expect(getDashboardMode(scene.state)).toBe('view');
  expect(scene.state.isDirty).toBe(false);
});
