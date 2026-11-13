import { waitFor } from '@testing-library/react';
import { makeDataSourceSettings } from 'test/helpers/makeDataSourceSettings';
import {
  type DataSourceFallbackWatcher,
  seedDataSources,
  watchDataSourceFallbacks,
} from 'test/helpers/seedDataSources';
import { MockDataSourceApi } from 'test/mocks/datasource_srv';

import { FieldType, LoadingState } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { FlagKeys } from '@grafana/runtime/internal';
import { type CustomVariable, VizPanel, sceneGraph } from '@grafana/scenes';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { appEvents } from 'app/core/app_events';

import { moveGridItem } from '../../actions/layout/moveGridItem';
import { moveRowToTab } from '../../actions/layout/moveRowToTab';
import { reorderRows } from '../../actions/layout/reorderRows';
import { edit } from '../../actions/utils/edit';
import { DashboardScene } from '../../scene/DashboardScene';
import { PlanPlaceholderBadge } from '../../scene/PlanPlaceholderBadge';
import { type DashboardGridItem } from '../../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';
import { RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';
import { TabsLayoutManager } from '../../scene/layout-tabs/TabsLayoutManager';
import { DashboardPlanChangedEvent, DashboardPlanningEvent } from '../../scene/planningEvents';
import * as planningSampleData from '../../scene/planningSampleData';
import { type DashboardLayoutManager } from '../../scene/types/DashboardLayoutManager';
import { type DashboardSceneState } from '../../scene/types/dashboard';
import { AddNewPane } from '../../sidebar/add-new/AddNewPane';
import { getQueryRunnerFor } from '../../utils/getQueryRunnerFor';
import { DashboardMutationClient } from '../DashboardMutationClient';

import { renderPlanContractFixture, renderPlanNestedTabsContractFixture } from './renderPlanContractFixture';

// A dashboard built from a spec carries the built-in annotation layer, which resolves its
// datasource on activation.
beforeEach(() => {
  const grafanaSettings = makeDataSourceSettings('-- Grafana --', 'Grafana', 'grafana');
  seedDataSources([{ settings: grafanaSettings, api: new MockDataSourceApi(grafanaSettings) }], { legacySrv: 'mock' });
});

setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({ id })),
  getPanelPluginFromCache: (id: string) => getPanelPlugin({ id }),
});

let cleanUpPreviousScene = () => {};

function setup(overrides: Partial<DashboardSceneState> = {}) {
  cleanUpPreviousScene();
  const scene = new DashboardScene({ title: 'hello', meta: { canEdit: true }, ...overrides });
  cleanUpPreviousScene = scene.activate();
  const client = new DashboardMutationClient(scene);
  return { scene, client };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

afterEach(() => {
  cleanUpPreviousScene();
  cleanUpPreviousScene = () => {};
});

const plan = {
  planId: 'plan-1',
  title: 'Kafka overview',
  layout: 'rows' as const,
  sections: [
    { title: 'Throughput', panels: [{ title: 'Requests', vizType: 'timeseries' }] },
    { title: 'Errors', panels: [{ title: 'Error rate', vizType: 'timeseries' }] },
  ],
};

let dataSourceFallbacks: DataSourceFallbackWatcher;

beforeEach(() => {
  dataSourceFallbacks = watchDataSourceFallbacks();
});

afterEach(() => {
  dataSourceFallbacks.expectNoFallbacks(['instance', 'settings', 'list']);
});

describe('RENDER_PLAN', () => {
  it('renders the whole plan in one call: rows, panels, and planning state', async () => {
    const { scene, client } = setup();

    const result = await client.execute({ type: 'RENDER_PLAN', payload: plan });

    expect(result.success).toBe(true);
    expect(scene.state.title).toBe('Kafka overview');
    expect(scene.state.body).toBeInstanceOf(RowsLayoutManager);
    const rows = (scene.state.body as RowsLayoutManager).state.rows;
    expect(rows.map((r) => r.state.title)).toEqual(['Throughput', 'Errors']);
    expect(scene.state.body.getVizPanels().map((p) => p.state.title)).toEqual(['Requests', 'Error rate']);
    expect(scene.state.planning).toMatchObject({ planId: 'plan-1', planTitle: 'Kafka overview' });
  });

  it('builds query-less placeholder panels with sample data, not a live query runner', async () => {
    const { scene, client } = setup();

    await client.execute({ type: 'RENDER_PLAN', payload: plan });

    const panel = scene.state.body.getVizPanels()[0];
    expect(getQueryRunnerFor(panel)).toBeUndefined();
    expect(sceneGraph.getData(panel).state.data?.series[0]).toBeDefined();
  });

  it('generates sample data once per placeholder, with preview settings and no live query runner', async () => {
    const { scene, client } = setup();
    const generateSample = jest.spyOn(planningSampleData, 'getPlanningPanelData');

    try {
      const result = await client.execute({ type: 'RENDER_PLAN', payload: plan });

      expect(result.success).toBe(true);
      expect(generateSample.mock.calls).toEqual([
        ['Requests', 'timeseries'],
        ['Error rate', 'timeseries'],
      ]);
      const panels = scene.state.body.getVizPanels();
      expect(panels.map((panel) => panel.state.fieldConfig.defaults.unit)).toEqual(['reqps', 'short']);
      for (const panel of panels) {
        const data = sceneGraph.getData(panel).state.data;
        expect(data?.state).toBe(LoadingState.Done);
        expect(data?.series).toHaveLength(1);
        expect(data?.series[0].length).toBe(60);
        expect(data?.series[0].fields.map(({ name, type }) => ({ name, type }))).toEqual([
          { name: 'time', type: FieldType.time },
          { name: 'pod-a1b2', type: FieldType.number },
          { name: 'pod-c3d4', type: FieldType.number },
          { name: 'pod-e5f6', type: FieldType.number },
        ]);
        expect(panel.state.options).toEqual({ legend: { showLegend: false }, tooltip: { mode: 'none' } });
        expect(panel.state.fieldConfig.defaults.custom).toEqual({
          drawStyle: 'line',
          lineWidth: 1,
          fillOpacity: 12,
          showPoints: 'never',
          spanNulls: true,
        });
        const titleItems = panel.state.titleItems;
        if (!Array.isArray(titleItems)) {
          throw new Error('Expected panel title items to be an array');
        }
        expect(titleItems.filter((item) => item instanceof PlanPlaceholderBadge)).toHaveLength(1);
        expect(getQueryRunnerFor(panel)).toBeUndefined();
      }
    } finally {
      generateSample.mockRestore();
    }
  });

  it('uses sample markdown for text placeholders without generating a data series', async () => {
    const { scene, client } = setup();

    const result = await client.execute({
      type: 'RENDER_PLAN',
      payload: {
        ...plan,
        sections: [{ title: 'Notes', panels: [{ title: 'p99 latency', vizType: 'text' }] }],
      },
    });

    expect(result.success).toBe(true);
    const panel = scene.state.body.getVizPanels()[0];
    expect(panel.state.options).toEqual({ mode: 'markdown', content: '_Notes for this section._' });
    expect(panel.state.fieldConfig.defaults.unit).toBe('ms');
    expect(sceneGraph.getData(panel).state.data).toMatchObject({ state: LoadingState.Done, series: [] });
    expect(getQueryRunnerFor(panel)).toBeUndefined();
    expect(panel.state.menu).toBeUndefined();
  });

  it('builds panels with no dropdown menu at all -- View is not read-only in practice', async () => {
    // A plugin's View pane can expose a Quick toggles section (timeseries sets
    // .setViewPanelOptions) that mutates panel options, with no isPlanning() gate. The menu is
    // cleared entirely rather than guarded, so there is no button at all.
    const { scene, client } = setup();

    await client.execute({ type: 'RENDER_PLAN', payload: plan });

    const panel = scene.state.body.getVizPanels()[0];
    expect(panel.state.menu).toBeUndefined();
  });

  it('renders tabs when layout is "tabs"', async () => {
    const { scene, client } = setup();

    await client.execute({ type: 'RENDER_PLAN', payload: { ...plan, layout: 'tabs' } });

    expect(scene.state.body).toBeInstanceOf(TabsLayoutManager);
    expect((scene.state.body as TabsLayoutManager).state.tabs.map((t) => t.state.title)).toEqual([
      'Throughput',
      'Errors',
    ]);
  });

  describe('rows nested inside a tab', () => {
    const nestedPlan = {
      ...plan,
      layout: 'tabs' as const,
      sections: [
        {
          title: 'Overview',
          panels: [],
          sections: [
            { title: 'Service health', panels: [{ title: 'Request rate', vizType: 'timeseries' }] },
            { title: 'Order flow', panels: [{ title: 'Revenue', vizType: 'timeseries' }] },
          ],
        },
        { title: 'Details', panels: [{ title: 'Orders by country', vizType: 'barchart' }] },
      ],
    };

    it('renders the nested rows and their panels instead of an empty tab', async () => {
      const { scene, client } = setup();

      const result = await client.execute({ type: 'RENDER_PLAN', payload: nestedPlan });

      expect(result.success).toBe(true);
      const [overview, details] = (scene.state.body as TabsLayoutManager).state.tabs;
      const overviewLayout = overview.getLayout();
      expect(overviewLayout).toBeInstanceOf(RowsLayoutManager);
      expect((overviewLayout as RowsLayoutManager).state.rows.map((r) => r.state.title)).toEqual([
        'Service health',
        'Order flow',
      ]);
      expect(overviewLayout.getVizPanels().map((p) => p.state.title)).toEqual(['Request rate', 'Revenue']);
      expect(details.getLayout()).toBeInstanceOf(DefaultGridLayoutManager);
      expect(scene.state.body.getVizPanels().map((p) => p.state.key)).toEqual(['panel-1', 'panel-2', 'panel-3']);
    });

    it('cannot drag or resize the grids inside nested rows', async () => {
      // todo: fix in a followup
      setTestFlags({ dashboardNewLayouts: false });
      try {
        const { scene, client } = setup();

        await client.execute({ type: 'RENDER_PLAN', payload: nestedPlan });

        const overview = (scene.state.body as TabsLayoutManager).state.tabs[0].getLayout() as RowsLayoutManager;
        const grid = (overview.state.rows[0].getLayout() as DefaultGridLayoutManager).state.grid;
        expect(grid.isDraggable()).toBe(false);
        expect(grid.state.isResizable).toBe(false);
      } finally {
        setTestFlags({});
      }
    });

    it('refuses nested rows when the plan layout is rows, and leaves the scene untouched', async () => {
      const { scene, client } = setup();

      const result = await client.execute({ type: 'RENDER_PLAN', payload: { ...nestedPlan, layout: 'rows' } });

      expect(result).toMatchObject({ success: false });
      expect(scene.state.title).toBe('hello');
      expect(scene.state.planning).toBeUndefined();
    });

    it('refuses a tab that has both its own panels and nested rows', async () => {
      const { scene, client } = setup();
      const [overview, details] = nestedPlan.sections;

      const result = await client.execute({
        type: 'RENDER_PLAN',
        payload: {
          ...nestedPlan,
          sections: [{ ...overview, panels: [{ title: 'Stray panel', vizType: 'stat' }] }, details],
        },
      });

      expect(result).toMatchObject({ success: false });
      expect(scene.state.planning).toBeUndefined();
    });
  });

  it('renders stand-in variables alongside the plan, with generated sample values', async () => {
    // The plan names only the variable, not what its values should look like -- sample values
    // are generated here rather than by the caller.
    const { scene, client } = setup();

    await client.execute({
      type: 'RENDER_PLAN',
      payload: { ...plan, variables: ['env'] },
    });

    const variable = scene.state.$variables?.state.variables[0];
    expect(variable?.state.name).toBe('env');
    expect((variable as CustomVariable).state.query.length).toBeGreaterThan(0);
  });

  it('shows a loading screen instead of the plan once it is building, with nothing left to decide', async () => {
    const { scene, client } = setup();
    await client.execute({ type: 'RENDER_PLAN', payload: { ...plan, variables: ['cluster'] } });

    const result = await client.execute({
      type: 'RENDER_PLAN',
      payload: { ...plan, variables: ['cluster'], phase: 'building' },
    });

    expect(result.success).toBe(true);
    expect(scene.state.title).toBe('Kafka overview');
    expect(scene.state.body.getVizPanels()).toHaveLength(0);
    expect(sceneGraph.getVariables(scene).state.variables).toHaveLength(0);
    expect(scene.state.planning).toEqual({ phase: 'building', planId: 'plan-1', planTitle: 'Kafka overview' });
    expect(scene.state.isEditing).toBeFalsy();

    const ended = await client.execute({ type: 'END_PLANNING', payload: { planId: 'plan-1' } });
    expect(ended.success).toBe(true);
    expect(scene.state.planning).toBeUndefined();
  });

  it('refuses when the scene is no longer open', async () => {
    const { scene, client } = setup();
    cleanUpPreviousScene();
    cleanUpPreviousScene = () => {};

    const result = await client.execute({ type: 'RENDER_PLAN', payload: plan });

    expect(result).toMatchObject({ success: false, error: 'The preview dashboard is no longer open.' });
    expect(scene.state.planning).toBeUndefined();
  });

  it('leaves the scene in view mode even though /dashboard/new enters edit mode on activation, and preserves the rendered plan rather than restoring the pre-plan snapshot', async () => {
    const { scene, client } = setup();

    // A fresh /dashboard/new scene enters edit mode unconditionally on activation, before
    // RENDER_PLAN ever runs.
    scene.onEnterEditMode();
    scene.state.sidebar.openPane(new AddNewPane({}));
    expect(scene.state.isEditing).toBe(true);
    expect(scene.state.sidebar.state.openPane?.getId()).toBe('add');
    scene.setState({ isDirty: true });

    const result = await client.execute({ type: 'RENDER_PLAN', payload: plan });

    expect(result.success).toBe(true);
    expect(scene.state.isEditing).toBe(false);
    expect(scene.state.isDirty).toBe(false);
    expect(scene.state.sidebar.state.openPane).toBeUndefined();
    // Assert the plan's own content survived, not the empty pre-plan snapshot.
    expect(scene.state.title).toBe('Kafka overview');
    expect(scene.state.body.getVizPanels().map((p) => p.state.title)).toEqual(['Requests', 'Error rate']);
    expect(scene.state.planning).toMatchObject({ planId: 'plan-1' });
  });

  it('preserves an editing dashboard with real panels when the preview is refused', async () => {
    const panel = new VizPanel({ title: 'User panel', pluginId: 'timeseries' });
    const { scene, client } = setup({ body: DefaultGridLayoutManager.fromVizPanels([panel]) });
    scene.onEnterEditMode();
    scene.setState({ title: 'User dashboard', description: 'Keep this description', isDirty: true });
    const sidebar = scene.state.sidebar;
    const closePane = jest.spyOn(sidebar, 'closePane');

    const result = await client.execute({ type: 'RENDER_PLAN', payload: plan });

    expect(result.success).toBe(false);
    expect(scene.state).toMatchObject({
      title: 'User dashboard',
      description: 'Keep this description',
      isEditing: true,
      isDirty: true,
    });
    expect(scene.state.body.getVizPanels()).toEqual([panel]);
    expect(closePane).not.toHaveBeenCalled();
  });

  it('does nothing extra when the scene was already in view mode', async () => {
    const { scene, client } = setup();
    expect(scene.state.isEditing).toBeFalsy();

    const result = await client.execute({ type: 'RENDER_PLAN', payload: plan });

    expect(result.success).toBe(true);
    expect(scene.state.isEditing).toBeFalsy();
  });

  describe('the rendered grid cannot actually be dragged or resized', () => {
    // DefaultGridLayoutManager hardcodes isDraggable/isResizable true; only editModeChanged (an
    // edit-mode transition) ever sets them false. Assert behaviour, not the raw flag, so a
    // future change that re-enables dragging some other way still fails this.
    function getGrid(scene: DashboardScene) {
      const rows = (scene.state.body as RowsLayoutManager).state.rows;
      return (rows[0].getLayout() as DefaultGridLayoutManager).state.grid;
    }

    it('on the marker path, where the scene never entered edit mode at all', async () => {
      const { scene, client } = setup();
      expect(scene.state.isEditing).toBeFalsy();

      await client.execute({ type: 'RENDER_PLAN', payload: plan });

      const grid = getGrid(scene);
      await waitFor(() => expect(grid.isDraggable()).toBe(false));
      expect(grid.getDragHooks()).toEqual({});
      expect(grid.state.isResizable).toBe(false);
    });

    it('on the fallback path, where the scene entered edit mode before RENDER_PLAN ran', async () => {
      const { scene, client } = setup();
      scene.onEnterEditMode();

      await client.execute({ type: 'RENDER_PLAN', payload: plan });

      const grid = getGrid(scene);
      await waitFor(() => expect(grid.isDraggable()).toBe(false));
      expect(grid.getDragHooks()).toEqual({});
      expect(grid.state.isResizable).toBe(false);
    });
  });

  describe('with plan editing enabled, the rendered grids can be arranged by hand', () => {
    const planEditingFlags = {
      [FlagKeys.GrafanaDashboardPreviewMode]: true,
      [FlagKeys.GrafanaDashboardComposer]: true,
      [FlagKeys.AssistantDashboardPlanEditing]: true,
    };

    beforeEach(() => setTestFlags(planEditingFlags));
    afterEach(() => setTestFlags({}));

    function getGrid(scene: DashboardScene) {
      const rows = (scene.state.body as RowsLayoutManager).state.rows;
      return (rows[0].getLayout() as DefaultGridLayoutManager).state.grid;
    }

    it('on the marker path, while the scene stays in view mode', async () => {
      const { scene, client } = setup();

      await client.execute({ type: 'RENDER_PLAN', payload: plan });

      const grid = getGrid(scene);
      await waitFor(() => expect(grid.isDraggable()).toBe(true));
      expect(grid.state.isResizable).toBe(true);
      expect(scene.state.isEditing).toBeFalsy();
    });

    it('on the fallback path, where exiting edit mode would otherwise turn dragging off again', async () => {
      const { scene, client } = setup();
      scene.onEnterEditMode();

      await client.execute({ type: 'RENDER_PLAN', payload: plan });

      const grid = getGrid(scene);
      await waitFor(() => expect(grid.isDraggable()).toBe(true));
      expect(grid.state.isResizable).toBe(true);
      expect(scene.state.isEditing).toBe(false);
    });

    it('stays fixed without the plan editing flag', async () => {
      setTestFlags({ ...planEditingFlags, [FlagKeys.AssistantDashboardPlanEditing]: false });
      const { scene, client } = setup();

      await client.execute({ type: 'RENDER_PLAN', payload: plan });

      const grid = getGrid(scene);
      await waitFor(() => expect(grid.isDraggable()).toBe(false));
      expect(grid.state.isResizable).toBe(false);
    });

    it('accepts moving a section but refuses any other edit', async () => {
      const { scene, client } = setup();
      await client.execute({ type: 'RENDER_PLAN', payload: plan });
      const deactivateSidebar = scene.state.sidebar.activate();

      try {
        const layout = scene.state.body as RowsLayoutManager;
        reorderRows(layout, 0, 1);
        expect(layout.state.rows.map((row) => row.state.title)).toEqual(['Errors', 'Throughput']);

        const perform = jest.fn();
        edit({ source: layout, meta: { actionId: 'panel.remove' }, perform, undo: jest.fn() });
        expect(perform).not.toHaveBeenCalled();
        expect(scene.state.isEditing).toBeFalsy();
      } finally {
        deactivateSidebar();
      }
    });

    it('accepts moving a panel into another section', async () => {
      const { scene, client } = setup();
      await client.execute({ type: 'RENDER_PLAN', payload: plan });
      const deactivateSidebar = scene.state.sidebar.activate();

      try {
        const [throughput, errors] = (scene.state.body as RowsLayoutManager).state.rows;
        const requests = throughput.getLayout().getVizPanels()[0];
        moveGridItem({
          source: throughput,
          destination: errors,
          gridItem: requests.parent as DashboardGridItem,
          originalIndex: 0,
        });

        expect(
          throughput
            .getLayout()
            .getVizPanels()
            .map((panel) => panel.state.title)
        ).toEqual([]);
        expect(
          errors
            .getLayout()
            .getVizPanels()
            .map((panel) => panel.state.title)
        ).toEqual(['Error rate', 'Requests']);
      } finally {
        deactivateSidebar();
      }
    });

    it('refuses moving a section without the plan editing flag', async () => {
      setTestFlags({ ...planEditingFlags, [FlagKeys.AssistantDashboardPlanEditing]: false });
      const { scene, client } = setup();
      await client.execute({ type: 'RENDER_PLAN', payload: plan });
      const deactivateSidebar = scene.state.sidebar.activate();

      try {
        const layout = scene.state.body as RowsLayoutManager;
        reorderRows(layout, 0, 1);
        expect(layout.state.rows.map((row) => row.state.title)).toEqual(['Throughput', 'Errors']);
      } finally {
        deactivateSidebar();
      }
    });

    it('stays fixed once the plan is building', async () => {
      const { scene, client } = setup();

      await client.execute({ type: 'RENDER_PLAN', payload: { ...plan, phase: 'building' } });

      const grid = getGrid(scene);
      await waitFor(() => expect(grid.isDraggable()).toBe(false));
      expect(grid.state.isResizable).toBe(false);
    });
  });

  describe('with plan editing enabled, the preview owns the plan', () => {
    beforeEach(() =>
      setTestFlags({
        [FlagKeys.GrafanaDashboardPreviewMode]: true,
        [FlagKeys.GrafanaDashboardComposer]: true,
        [FlagKeys.AssistantDashboardPlanEditing]: true,
      })
    );
    afterEach(() => setTestFlags({}));

    const arrangedPlan = {
      planId: 'plan-1',
      title: 'Kafka overview',
      layout: 'rows' as const,
      sections: [
        {
          id: 'throughput',
          title: 'Throughput',
          panels: [
            {
              id: 4,
              title: 'Requests',
              vizType: 'timeseries',
              intent: 'Requests per second by topic',
              visualization: 'line chart',
              gridPos: { x: 0, y: 0, w: 16, h: 8 },
            },
            { id: 9, title: 'Bytes in', vizType: 'timeseries', gridPos: { x: 16, y: 0, w: 8, h: 8 } },
          ],
        },
        { id: 'errors', title: 'Errors', panels: [{ id: 2, title: 'Error rate', vizType: 'stat' }] },
      ],
    };

    function getEditablePlan(scene: DashboardScene) {
      const { planning } = scene.state;
      return planning?.phase === 'preview' ? planning.editable : undefined;
    }

    function getRows(scene: DashboardScene) {
      return (scene.state.body as RowsLayoutManager).state.rows;
    }

    function getGridItems(layout: DashboardLayoutManager) {
      return (layout as DefaultGridLayoutManager).state.grid.state.children as DashboardGridItem[];
    }

    function collectPlanningEvents() {
      const events: Array<DashboardPlanningEvent['payload'] | DashboardPlanChangedEvent['payload']> = [];
      const decisions = appEvents.subscribe(DashboardPlanningEvent, (event) => events.push(event.payload));
      const changes = appEvents.subscribe(DashboardPlanChangedEvent, (event) => events.push(event.payload));
      return {
        events,
        unsubscribe: () => {
          decisions.unsubscribe();
          changes.unsubscribe();
        },
      };
    }

    it('names panels and sections by their plan ids, and places panels where the plan says', async () => {
      const { scene, client } = setup();

      await client.execute({ type: 'RENDER_PLAN', payload: arrangedPlan });

      const [throughput, errors] = getRows(scene);
      expect(throughput.state.key).toBe('plan-section-throughput');
      expect(errors.state.key).toBe('plan-section-errors');
      expect(
        getGridItems(throughput.getLayout()).map(({ state }) => [state.body.state.key, state.x, state.y, state.width])
      ).toEqual([
        ['panel-4', 0, 0, 16],
        ['panel-9', 16, 0, 8],
      ]);
      expect(throughput.getLayout().getVizPanels()[0].state.description).toBe('Requests per second by topic');
    });

    it('keeps the plan, with ids for everything and every position as rendered', async () => {
      const { scene, client } = setup();

      const result = await client.execute({ type: 'RENDER_PLAN', payload: plan });

      expect(result.data).toEqual(getEditablePlan(scene));
      expect(getEditablePlan(scene)).toEqual({
        revision: 0,
        plan: {
          title: 'Kafka overview',
          layout: 'rows',
          sections: [
            {
              id: 'section-1',
              title: 'Throughput',
              panels: [{ id: 1, title: 'Requests', vizType: 'timeseries', gridPos: { x: 0, y: 0, w: 8, h: 10 } }],
            },
            {
              id: 'section-2',
              title: 'Errors',
              panels: [{ id: 2, title: 'Error rate', vizType: 'timeseries', gridPos: { x: 0, y: 0, w: 8, h: 10 } }],
            },
          ],
        },
      });
    });

    it('packs a section automatically unless every panel in it has a position', async () => {
      const { scene, client } = setup();
      const [throughput] = arrangedPlan.sections;
      const partlyPlaced = {
        ...arrangedPlan,
        sections: [{ ...throughput, panels: [throughput.panels[0], { ...throughput.panels[1], gridPos: undefined }] }],
      };

      await client.execute({ type: 'RENDER_PLAN', payload: partlyPlaced });

      expect(getGridItems(getRows(scene)[0].getLayout()).map(({ state }) => [state.x, state.width])).toEqual([
        [0, 8],
        [8, 8],
      ]);
    });

    it('refuses a plan that gives two panels the same id', async () => {
      const { scene, client } = setup();
      const [throughput, errors] = arrangedPlan.sections;

      const result = await client.execute({
        type: 'RENDER_PLAN',
        payload: { ...arrangedPlan, sections: [throughput, { ...errors, panels: [{ ...errors.panels[0], id: 4 }] }] },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Panel id 4 is used more than once.');
      expect(scene.isPlanning()).toBe(false);
    });

    it('takes a panel moved to another section into the plan, and reports the new revision', async () => {
      const { scene, client } = setup();
      await client.execute({ type: 'RENDER_PLAN', payload: arrangedPlan });
      const deactivateSidebar = scene.state.sidebar.activate();
      const { events, unsubscribe } = collectPlanningEvents();

      try {
        const [throughput, errors] = getRows(scene);
        moveGridItem({
          source: throughput,
          destination: errors,
          gridItem: getGridItems(throughput.getLayout())[1],
          originalIndex: 1,
        });

        const editable = getEditablePlan(scene);
        expect(editable?.revision).toBe(1);
        expect(editable?.plan.sections.map(({ id, panels }) => [id, panels.map((panel) => panel.id)])).toEqual([
          ['throughput', [4]],
          ['errors', [2, 9]],
        ]);
        // Content comes from the plan, not the scene.
        expect(editable?.plan.sections[0].panels[0]).toMatchObject({
          title: 'Requests',
          intent: 'Requests per second by topic',
          visualization: 'line chart',
        });
        // Not a DashboardPlanningEvent, which a listener that predates plan editing reads as a dismissal.
        expect(events).toEqual([{ planId: 'plan-1', revision: 1 }]);
      } finally {
        unsubscribe();
        deactivateSidebar();
      }
    });

    it('takes a resize into the plan', async () => {
      const { scene, client } = setup();
      await client.execute({ type: 'RENDER_PLAN', payload: arrangedPlan });
      const deactivateSidebar = scene.state.sidebar.activate();

      try {
        const layout = getRows(scene)[0].getLayout() as DefaultGridLayoutManager;
        const cells = getGridItems(layout).map(({ state }) => ({
          i: state.key!,
          x: state.x ?? 0,
          y: state.y ?? 0,
          w: state.width ?? 0,
          h: state.height ?? 0,
        }));
        layout.state.grid.onResizeStop([{ ...cells[0], w: 12, h: 6 }, cells[1]]);

        expect(getEditablePlan(scene)?.plan.sections[0].panels[0].gridPos).toEqual({ x: 0, y: 0, w: 12, h: 6 });
        expect(getEditablePlan(scene)?.revision).toBe(1);
      } finally {
        deactivateSidebar();
      }
    });

    it('takes a section reorder into the plan', async () => {
      const { scene, client } = setup();
      await client.execute({ type: 'RENDER_PLAN', payload: arrangedPlan });
      const deactivateSidebar = scene.state.sidebar.activate();

      try {
        reorderRows(scene.state.body as RowsLayoutManager, 0, 1);

        expect(getEditablePlan(scene)?.plan.sections.map((section) => section.id)).toEqual(['errors', 'throughput']);
        expect(getEditablePlan(scene)?.revision).toBe(1);
      } finally {
        deactivateSidebar();
      }
    });

    it("takes a tab's only row moved to another tab into the plan, leaving the first tab empty", async () => {
      const { scene, client } = setup();
      await client.execute({
        type: 'RENDER_PLAN',
        payload: {
          planId: 'plan-1',
          title: 'Kafka overview',
          layout: 'tabs',
          sections: [
            {
              id: 'alpha',
              title: 'Alpha',
              panels: [],
              sections: [{ id: 'metrics', title: 'Metrics', panels: [{ id: 1, title: 'CPU', vizType: 'timeseries' }] }],
            },
            {
              id: 'beta',
              title: 'Beta',
              panels: [],
              sections: [{ id: 'logs', title: 'Logs', panels: [{ id: 2, title: 'Errors', vizType: 'logs' }] }],
            },
          ],
        },
      });
      const deactivateSidebar = scene.state.sidebar.activate();

      try {
        const [alpha, beta] = (scene.state.body as TabsLayoutManager).state.tabs;
        const source = alpha.getLayout() as RowsLayoutManager;
        moveRowToTab({ row: source.state.rows[0], source, destination: beta });

        const editable = getEditablePlan(scene);
        expect(editable?.revision).toBe(1);
        expect(
          editable?.plan.sections.map(({ id, panels, sections }) => [
            id,
            panels.map((panel) => panel.id),
            sections?.map((row) => [row.id, row.panels.map((panel) => panel.id)]),
          ])
        ).toEqual([
          ['alpha', [], undefined],
          [
            'beta',
            [],
            [
              ['logs', [2]],
              ['metrics', [1]],
            ],
          ],
        ]);

        // A panel dropped into the emptied tab lands in a grid the plan can describe.
        const emptied = alpha.getLayout();
        expect(emptied).toBeInstanceOf(DefaultGridLayoutManager);
        const [, metrics] = (beta.getLayout() as RowsLayoutManager).state.rows;
        moveGridItem({
          source: metrics,
          destination: alpha,
          gridItem: getGridItems(metrics.getLayout())[0],
          originalIndex: 0,
        });

        expect(getEditablePlan(scene)?.revision).toBe(2);
        expect(getEditablePlan(scene)?.plan.sections[0]).toMatchObject({
          id: 'alpha',
          panels: [{ id: 1, title: 'CPU' }],
        });
      } finally {
        deactivateSidebar();
      }
    });

    it('reports the arranged plan with Build, Dismiss and closing the preview', async () => {
      const { scene, client } = setup();
      await client.execute({ type: 'RENDER_PLAN', payload: arrangedPlan });
      const deactivateSidebar = scene.state.sidebar.activate();
      const { events, unsubscribe } = collectPlanningEvents();

      try {
        reorderRows(scene.state.body as RowsLayoutManager, 0, 1);
        const { planning } = scene.state;
        if (planning?.phase !== 'preview' || !planning.editable) {
          throw new Error('Expected an editable plan preview');
        }
        const arranged = planning.editable;
        planning.onBuild();
        planning.onDismiss();
        cleanUpPreviousScene();
        cleanUpPreviousScene = () => {};

        expect(arranged.revision).toBe(1);
        expect(arranged.plan.sections.map((section) => section.id)).toEqual(['errors', 'throughput']);
        expect(events.slice(1)).toEqual([
          { planId: 'plan-1', action: 'build', ...arranged },
          { planId: 'plan-1', action: 'dismiss', ...arranged },
          { planId: 'plan-1', action: 'closed', ...arranged },
        ]);
      } finally {
        unsubscribe();
        deactivateSidebar();
      }
    });

    it('builds a skeleton of the plan as arranged: real panels, the same keys and layout, no sample data', async () => {
      const { scene, client } = setup();
      await client.execute({ type: 'RENDER_PLAN', payload: arrangedPlan });
      const deactivateSidebar = scene.state.sidebar.activate();
      try {
        const [throughput, errors] = getRows(scene);
        moveGridItem({
          source: throughput,
          destination: errors,
          gridItem: getGridItems(throughput.getLayout())[1],
          originalIndex: 1,
        });
      } finally {
        deactivateSidebar();
      }
      const arranged = getEditablePlan(scene)?.plan;

      // The payload is the plan as proposed; the arranged one in the preview wins.
      const result = await client.execute({ type: 'RENDER_PLAN', payload: { ...arrangedPlan, phase: 'building' } });

      expect(result.data).toEqual({ plan: arranged });

      expect(scene.state.planning).toMatchObject({ phase: 'building', planId: 'plan-1' });
      const [throughput, errors] = getRows(scene);
      expect([throughput.state.title, errors.state.title]).toEqual(['Throughput', 'Errors']);
      const placed = (layout: DashboardLayoutManager) =>
        getGridItems(layout).map(({ state }) => [state.body.state.key, state.x, state.y, state.width, state.height]);
      expect(placed(throughput.getLayout())).toEqual([['panel-4', 0, 0, 16, 8]]);
      expect(placed(errors.getLayout())).toEqual(
        arranged?.sections[1].panels.map(({ id, gridPos }) => [
          `panel-${id}`,
          gridPos?.x,
          gridPos?.y,
          gridPos?.w,
          gridPos?.h,
        ])
      );
      for (const panel of scene.state.body.getVizPanels()) {
        expect(getQueryRunnerFor(panel)).toBeDefined();
        expect(panel.state.menu).toBeDefined();
        expect(panel.state.description).toBeFalsy();
        const titleItems = Array.isArray(panel.state.titleItems) ? panel.state.titleItems : [];
        expect(titleItems.some((item) => item instanceof PlanPlaceholderBadge)).toBe(false);
      }
      expect(scene.state.$variables?.state.variables).toEqual([]);
    });

    it('builds the skeleton from the payload when no preview of the plan is open', async () => {
      const { scene, client } = setup();

      await client.execute({ type: 'RENDER_PLAN', payload: { ...arrangedPlan, phase: 'building' } });

      expect(scene.state.body.getVizPanels().map((panel) => panel.state.key)).toEqual([
        'panel-4',
        'panel-9',
        'panel-2',
      ]);
    });

    it('clears undo history recorded against the panels a render replaces', async () => {
      const { scene, client } = setup();
      await client.execute({ type: 'RENDER_PLAN', payload: arrangedPlan });
      const deactivateSidebar = scene.state.sidebar.activate();

      try {
        reorderRows(scene.state.body as RowsLayoutManager, 0, 1);
        expect(scene.state.sidebar.state.undoStack).toHaveLength(1);

        await client.execute({ type: 'RENDER_PLAN', payload: { ...arrangedPlan, phase: 'building' } });

        expect(scene.state.sidebar.state.undoStack).toEqual([]);
      } finally {
        deactivateSidebar();
      }
    });
  });

  describe('GET_PLAN', () => {
    beforeEach(() =>
      setTestFlags({
        [FlagKeys.GrafanaDashboardPreviewMode]: true,
        [FlagKeys.GrafanaDashboardComposer]: true,
        [FlagKeys.AssistantDashboardPlanEditing]: true,
      })
    );
    afterEach(() => setTestFlags({}));

    it('reads the plan the preview owns, with its revision, while every other command is refused', async () => {
      const { scene, client } = setup();
      await client.execute({ type: 'RENDER_PLAN', payload: plan });

      const result = await client.execute({ type: 'GET_PLAN', payload: { planId: 'plan-1' } });

      expect(result.success).toBe(true);
      const { planning } = scene.state;
      expect(result.data).toEqual(planning?.phase === 'preview' ? planning.editable : undefined);
      expect(result.data).toMatchObject({ revision: 0, plan: { title: 'Kafka overview' } });
    });

    it('refuses a plan that is not the one being previewed', async () => {
      const { client } = setup();
      await client.execute({ type: 'RENDER_PLAN', payload: plan });

      const result = await client.execute({ type: 'GET_PLAN', payload: { planId: 'plan-0' } });

      expect(result).toMatchObject({ success: false, error: 'No editable preview of this plan is open.' });
    });

    it('is not available with plan editing off', async () => {
      setTestFlags({});
      const { client } = setup();
      await client.execute({ type: 'RENDER_PLAN', payload: plan });

      const result = await client.execute({ type: 'GET_PLAN', payload: { planId: 'plan-1' } });

      expect(result.success).toBe(false);
    });
  });

  describe('precondition: refuses any target that is not a blank, unsaved dashboard', () => {
    // RENDER_PLAN replaces the whole body and END_PLANNING clears unconditionally -- safe only
    // if the target was already blank and unsaved. These guard against a caller that reaches
    // RENDER_PLAN some other way, on a dashboard that has something to lose.

    it('refuses a dashboard that already has panels, and leaves them untouched', async () => {
      const existingPanel = new VizPanel({ key: 'panel-1', title: 'Existing panel', pluginId: 'timeseries' });
      const { scene, client } = setup({ body: DefaultGridLayoutManager.fromVizPanels([existingPanel]) });

      const result = await client.execute({ type: 'RENDER_PLAN', payload: plan });

      expect(result).toMatchObject({ success: false });
      expect(scene.state.title).toBe('hello');
      expect(scene.state.body.getVizPanels().map((p) => p.state.title)).toEqual(['Existing panel']);
      expect(scene.state.planning).toBeUndefined();
    });

    it('refuses a dirty dashboard, even with no panels', async () => {
      const { scene, client } = setup();
      scene.setState({ isDirty: true });

      const result = await client.execute({ type: 'RENDER_PLAN', payload: plan });

      expect(result).toMatchObject({ success: false });
      expect(scene.state.planning).toBeUndefined();
    });

    it('refuses a saved dashboard (has a uid), even if blank and not dirty', async () => {
      const { scene, client } = setup({ uid: 'existing-dash-uid' });

      const result = await client.execute({ type: 'RENDER_PLAN', payload: plan });

      expect(result).toMatchObject({ success: false });
      expect(scene.state.planning).toBeUndefined();
    });

    it('succeeds against a blank, unsaved, non-dirty dashboard -- the only case the product uses', async () => {
      const { scene, client } = setup();

      const result = await client.execute({ type: 'RENDER_PLAN', payload: plan });

      expect(result.success).toBe(true);
      expect(scene.state.planning).toBeDefined();
      // The plan is only returned with plan editing on.
      expect(result.data).toBeUndefined();
    });

    it('does not refuse a re-render of an already-planning scene, even though it now has panels', async () => {
      const { scene, client } = setup();
      await client.execute({ type: 'RENDER_PLAN', payload: plan });
      expect(scene.state.body.getVizPanels().length).toBeGreaterThan(0);

      const result = await client.execute({
        type: 'RENDER_PLAN',
        payload: { ...plan, planId: 'plan-2', title: 'Replacement' },
      });

      expect(result.success).toBe(true);
      expect(scene.state.title).toBe('Replacement');
    });
  });

  it('only notifies the most recent plan: a stale onBuild/onDismiss closure is a no-op', async () => {
    const { scene, client } = setup();

    await client.execute({ type: 'RENDER_PLAN', payload: plan });
    const stalePlanning = scene.state.planning;
    expect(stalePlanning).toBeDefined();

    // A second render replaces the first plan before the stale closure ever fires.
    await client.execute({ type: 'RENDER_PLAN', payload: { ...plan, planId: 'plan-2', title: 'Replacement' } });

    if (stalePlanning?.phase !== 'preview') {
      throw new Error('Expected a preview to be rendered');
    }
    expect(() => stalePlanning.onBuild()).not.toThrow();
    expect(scene.state.planning?.planId).toBe('plan-2');
  });

  it("CONTRACT: accepts and renders the fixture payload the assistant's mapper is expected to produce", async () => {
    // See renderPlanContractFixture.ts: the assistant repo asserts its mapper produces exactly
    // this object. This is core's half, that RENDER_PLAN accepts and renders it correctly.
    const { scene, client } = setup();

    const result = await client.execute({ type: 'RENDER_PLAN', payload: renderPlanContractFixture });

    expect(result.success).toBe(true);
    expect(scene.state.title).toBe(renderPlanContractFixture.title);
    expect(scene.state.description).toBe(renderPlanContractFixture.description);
    expect(scene.state.body).toBeInstanceOf(RowsLayoutManager);
    expect((scene.state.body as RowsLayoutManager).state.rows.map((r) => r.state.title)).toEqual(
      renderPlanContractFixture.sections.map((s) => s.title)
    );
    expect(scene.state.body.getVizPanels().map((p) => p.state.title)).toEqual(
      renderPlanContractFixture.sections.flatMap((s) => s.panels.map((p) => p.title))
    );
    expect(scene.state.$variables?.state.variables.map((v) => v.state.name)).toEqual(
      renderPlanContractFixture.variables
    );
  });

  it('CONTRACT: accepts and renders the nested-tabs fixture payload', async () => {
    const { scene, client } = setup();

    const result = await client.execute({ type: 'RENDER_PLAN', payload: renderPlanNestedTabsContractFixture });

    expect(result.success).toBe(true);
    expect(scene.state.body).toBeInstanceOf(TabsLayoutManager);
    expect((scene.state.body as TabsLayoutManager).state.tabs.map((t) => t.state.title)).toEqual(
      renderPlanNestedTabsContractFixture.sections.map((s) => s.title)
    );
    expect(scene.state.body.getVizPanels().map((p) => p.state.title)).toEqual(
      renderPlanNestedTabsContractFixture.sections.flatMap((s) =>
        (s.sections ?? [s]).flatMap((row) => row.panels.map((p) => p.title))
      )
    );
  });
});

describe('other mutation commands, while a plan preview is active', () => {
  // A planning scene is not a mutation target: DashboardMutationClient refuses every mutating
  // command except RENDER_PLAN/END_PLANNING (see DashboardMutationClient.test.ts). Covered here
  // too, so RENDER_PLAN's own test suite proves the isPlanning() it sets actually blocks a write.
  it('lets the first build write replace a building screen, keeping the screen up until it lands', async () => {
    const { scene, client } = setup();
    await client.execute({ type: 'RENDER_PLAN', payload: { ...plan, phase: 'building' } });
    const phaseWhenPanelsLanded: Array<string | undefined> = [];
    const subscription = scene.subscribeToState((state, prev) => {
      if (state.body !== prev.body || state.body.getVizPanels().length > 0) {
        phaseWhenPanelsLanded.push(state.planning?.phase);
      }
    });

    const result = await client.execute({
      type: 'ADD_PANEL',
      payload: {
        panel: {
          kind: 'Panel',
          spec: {
            title: 'New panel',
            vizConfig: { group: 'timeseries', spec: { options: {}, fieldConfig: { defaults: {}, overrides: [] } } },
            data: { kind: 'QueryGroup', spec: { queries: [], transformations: [], queryOptions: {} } },
          },
        },
      },
    });
    subscription.unsubscribe();

    expect(result.success).toBe(true);
    expect(scene.state.body.getVizPanels().map((panel) => panel.state.title)).toEqual(['New panel']);
    expect(phaseWhenPanelsLanded[0]).toBe('building');
    expect(scene.state.planning).toBeUndefined();
  });

  it('keeps the building screen up when the first build write is rejected', async () => {
    const { scene, client } = setup();
    await client.execute({ type: 'RENDER_PLAN', payload: { ...plan, phase: 'building' } });

    const result = await client.execute({ type: 'ADD_PANEL', payload: { panel: { invalid: true } } });

    expect(result.success).toBe(false);
    expect(scene.state.planning?.phase).toBe('building');
  });

  it('does not bring the building screen back when the first write is discarded', async () => {
    const { scene, client } = setup();
    await client.execute({ type: 'RENDER_PLAN', payload: { ...plan, phase: 'building' } });
    await client.execute({
      type: 'ADD_PANEL',
      payload: {
        panel: {
          kind: 'Panel',
          spec: {
            title: 'New panel',
            vizConfig: { group: 'timeseries', spec: { options: {}, fieldConfig: { defaults: {}, overrides: [] } } },
            data: { kind: 'QueryGroup', spec: { queries: [], transformations: [], queryOptions: {} } },
          },
        },
      },
    });
    expect(scene.state.isEditing).toBe(true);

    scene.exitEditMode({ skipConfirm: true, restoreInitialState: true });

    expect(scene.state.planning).toBeUndefined();
  });

  it('does not bring the building screen back when the first APPLY_SPEC is undone', async () => {
    const { scene, client } = setup();
    await client.execute({ type: 'RENDER_PLAN', payload: { ...plan, phase: 'building' } });
    const current = await client.execute({ type: 'GET_SPEC', payload: {} });
    if (!current.success || !isRecord(current.data) || !isRecord(current.data.spec)) {
      throw new Error('Expected GET_SPEC to return the current spec');
    }

    const applied = await client.execute({
      type: 'APPLY_SPEC',
      payload: { spec: { ...current.data.spec, title: 'Built dashboard' } },
    });
    expect(applied.success).toBe(true);
    expect(scene.state.planning).toBeUndefined();

    scene.state.sidebar.undoAction();

    expect(scene.state.planning).toBeUndefined();
  });

  it('ADD_PANEL is refused, not applied', async () => {
    const { scene, client } = setup();
    await client.execute({ type: 'RENDER_PLAN', payload: plan });
    const panelCountBefore = scene.state.body.getVizPanels().length;

    const result = await client.execute({
      type: 'ADD_PANEL',
      payload: {
        panel: {
          kind: 'Panel',
          spec: {
            title: 'New panel',
            vizConfig: { group: 'timeseries', spec: { options: {}, fieldConfig: { defaults: {}, overrides: [] } } },
            data: { kind: 'QueryGroup', spec: { queries: [], transformations: [], queryOptions: {} } },
          },
        },
      },
    });

    expect(result.success).toBe(false);
    expect(scene.state.body.getVizPanels()).toHaveLength(panelCountBefore);
  });
});
