import { cloneDeep } from 'lodash';
import { of } from 'rxjs';

import {
  FieldType,
  LoadingState,
  type PanelData,
  VariableSupportType,
  getDefaultTimeRange,
  toDataFrame,
} from '@grafana/data';
import { locationService, setRunRequest } from '@grafana/runtime';
import {
  type AdHocFiltersVariable,
  type MultiValueVariable,
  NewSceneObjectAddedEvent,
  sceneGraph,
  UrlSyncManager,
  type SceneObject,
} from '@grafana/scenes';
import {
  defaultAdhocVariableKind,
  defaultPanelKind,
  defaultQueryVariableKind,
  defaultSpec as defaultDashboardV2Spec,
  type GridLayoutItemKind,
  type PanelKind,
  type Spec as DashboardV2Spec,
  type VariableKind,
} from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { type DashboardWithAccessInfo } from 'app/features/dashboard/api/types';
import { DashboardCodePane } from 'app/features/dashboard-scene/sidebar/DashboardCodePane';

import { type DashboardScene } from '../../scene/DashboardScene';
import { RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';
import { TabsLayoutManager } from '../../scene/layout-tabs/TabsLayoutManager';
import { transformSaveModelSchemaV2ToScene } from '../../serialization/transformSaveModelSchemaV2ToScene';
import { AddNewPane } from '../../sidebar/add-new/AddNewPane';
import { findVizPanelByKey } from '../../utils/findVizPanel';
import { getEditableElementFor } from '../utils/getEditableElementFor';

import { applyDashboardSpec } from './applyDashboardSpec';

const variableDatasource = {
  name: 'Variables',
  uid: 'variables-ds',
  type: 'test',
  meta: { id: 'test', info: { logos: {} } },
  getRef: () => ({ uid: 'variables-ds', type: 'test' }),
};

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    get: async () => ({
      ...variableDatasource,
      variables: { getType: () => VariableSupportType.Custom, query: jest.fn(), editor: jest.fn() },
    }),
    getList: () => [variableDatasource],
    getInstanceSettings: () => variableDatasource,
  }),
}));

// Counts serializations, which is what reading a spec's URL state off the live dashboard costs.
// A plain passthrough rather than a `jest.fn`, so the `restoreAllMocks` below cannot strip it.
let mockSerializeCount = 0;
jest.mock('../../serialization/transformSceneToSaveModelSchemaV2', () => {
  const actual = jest.requireActual('../../serialization/transformSceneToSaveModelSchemaV2');
  return {
    ...actual,
    transformSceneToSaveModelSchemaV2: (...args: Parameters<typeof actual.transformSceneToSaveModelSchemaV2>) => {
      mockSerializeCount++;
      return actual.transformSceneToSaveModelSchemaV2(...args);
    },
  };
});

// Query variable options load asynchronously, after the rebuilt children are synced from the URL.
setRunRequest(
  jest.fn().mockReturnValue(
    of<PanelData>({
      state: LoadingState.Done,
      series: [toDataFrame({ fields: [{ name: 'text', type: FieldType.string, values: ['a', 'b', 'x', 'y'] }] })],
      timeRange: getDefaultTimeRange(),
    })
  )
);

function makeSpec(title: string): DashboardV2Spec {
  return { ...defaultDashboardV2Spec(), title, elements: {} };
}

function makePanel(id: number, title: string): PanelKind {
  return { ...defaultPanelKind(), spec: { ...defaultPanelKind().spec, id, title } };
}

function gridItem(panelName: string): GridLayoutItemKind {
  return {
    kind: 'GridLayoutItem',
    spec: { x: 0, y: 0, width: 12, height: 8, element: { kind: 'ElementReference', name: panelName } },
  };
}

function makeRowsSpec(title: string): DashboardV2Spec {
  return {
    ...defaultDashboardV2Spec(),
    title,
    elements: {
      'panel-1': makePanel(1, 'Panel 1'),
      'panel-2': makePanel(2, 'Panel 2'),
    },
    layout: {
      kind: 'RowsLayout',
      spec: {
        rows: [
          {
            kind: 'RowsLayoutRow',
            spec: { title: 'Row 1', layout: { kind: 'GridLayout', spec: { items: [gridItem('panel-1')] } } },
          },
          {
            kind: 'RowsLayoutRow',
            spec: { title: 'Row 2', layout: { kind: 'GridLayout', spec: { items: [gridItem('panel-2')] } } },
          },
        ],
      },
    },
  };
}

function makeTabsSpec(title: string): DashboardV2Spec {
  return {
    ...defaultDashboardV2Spec(),
    title,
    elements: {
      'panel-1': makePanel(1, 'Panel 1'),
      'panel-2': makePanel(2, 'Panel 2'),
    },
    layout: {
      kind: 'TabsLayout',
      spec: {
        tabs: [
          {
            kind: 'TabsLayoutTab',
            spec: { title: 'Tab 1', layout: { kind: 'GridLayout', spec: { items: [gridItem('panel-1')] } } },
          },
          {
            kind: 'TabsLayoutTab',
            spec: { title: 'Tab 2', layout: { kind: 'GridLayout', spec: { items: [gridItem('panel-2')] } } },
          },
        ],
      },
    },
  };
}

function buildScene(spec: DashboardV2Spec, libraryPanelRepeatResolved?: boolean): DashboardScene {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal resource envelope for the test
  const dto = {
    kind: 'DashboardWithAccessInfo',
    apiVersion: 'dashboard.grafana.app/v2beta1',
    metadata: { name: 'dash-1', generation: 1, creationTimestamp: '2026-08-03T00:00:00Z', annotations: {} },
    access: { canEdit: true, canSave: true, canShare: true, canStar: true, canDelete: true, canAdmin: true },
    spec: cloneDeep(spec),
    libraryPanelRepeatResolved,
  } as unknown as DashboardWithAccessInfo<DashboardV2Spec>;

  const scene = transformSaveModelSchemaV2ToScene(dto);
  scene.state.sidebar.activate();
  scene.setState({ isEditing: true });
  return scene;
}

function queryVariable(name: string, value: string, multi: boolean): VariableKind {
  const variable = defaultQueryVariableKind();
  variable.spec = {
    ...variable.spec,
    name,
    multi,
    includeAll: multi,
    refresh: 'onDashboardLoad',
    current: { text: value === '$__all' ? 'All' : value, value },
    query: { kind: 'DataQuery', group: 'test', version: 'v0', datasource: { name: 'variables-ds' }, spec: {} },
  };
  return variable;
}

function adhocVariable(defaultEnv: string): VariableKind {
  const variable = defaultAdhocVariableKind();
  variable.group = 'test';
  variable.datasource = { name: 'variables-ds' };
  variable.spec = {
    ...variable.spec,
    name: 'filters',
    filters: [{ key: 'env', operator: '=', value: defaultEnv, origin: 'dashboard' }],
  };
  return variable;
}

function makeSyncedSpec({
  title = 'Variables',
  namespace = 'a',
  service = '$__all',
  sections = [],
  adhoc,
  time = {},
  tabs = [],
}: {
  title?: string;
  namespace?: string;
  service?: string;
  /** One row per entry, each with a `pod` section variable set to that value. */
  sections?: string[];
  adhoc?: string;
  time?: Partial<DashboardV2Spec['timeSettings']>;
  /** One tab per entry, titled with that value. */
  tabs?: string[];
} = {}): DashboardV2Spec {
  const defaults = defaultDashboardV2Spec();
  const spec: DashboardV2Spec = {
    ...defaults,
    title,
    elements: {},
    timeSettings: { ...defaults.timeSettings, ...time },
    variables: [queryVariable('namespace', namespace, false), queryVariable('service', service, true)],
  };
  if (adhoc) {
    spec.variables.push(adhocVariable(adhoc));
  }
  if (sections.length > 0) {
    spec.layout = {
      kind: 'RowsLayout',
      spec: {
        rows: sections.map((pod, index) => ({
          kind: 'RowsLayoutRow',
          spec: {
            title: `Row ${index + 1}`,
            layout: { kind: 'GridLayout', spec: { items: [] } },
            variables: [queryVariable('pod', pod, false)],
          },
        })),
      },
    };
  }
  if (tabs.length > 0) {
    spec.layout = {
      kind: 'TabsLayout',
      spec: {
        tabs: tabs.map((tabTitle) => ({
          kind: 'TabsLayoutTab',
          spec: { title: tabTitle, layout: { kind: 'GridLayout', spec: { items: [] } } },
        })),
      },
    };
  }
  return spec;
}

function lookup<T extends SceneObject>(scene: DashboardScene, name: string): T {
  const variable = sceneGraph.findObject(scene, (obj) => 'name' in obj.state && obj.state.name === name);
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the test variables are known by name
  return variable as T;
}

const value = (scene: DashboardScene, name: string) => lookup<MultiValueVariable>(scene, name).getValue();
const url = () => new URLSearchParams(locationService.getLocation().search);
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('applyDashboardSpec', () => {
  it('preserves the sidebar instance across the rebuild, so its undo/redo stack survives', () => {
    const scene = buildScene(makeSpec('Old title'));
    const originalSidebar = scene.state.sidebar;

    applyDashboardSpec({ scene, spec: makeSpec('New title'), description: 'Apply spec', scope: 'code-pane' });

    expect(scene.state.sidebar).toBe(originalSidebar);
  });

  it('keeps libraryPanelRepeatResolved across the rebuild', () => {
    const scene = buildScene(makeSpec('Old title'), true);
    expect(scene.state.meta.libraryPanelRepeatResolved).toBe(true);

    applyDashboardSpec({ scene, spec: makeSpec('New title'), description: 'Apply spec', scope: 'code-pane' });

    expect(scene.state.meta.libraryPanelRepeatResolved).toBe(true);
  });

  it('applies the spec, and undo/redo toggle between the old and new scene', () => {
    const scene = buildScene(makeSpec('Old title'));
    const originalBody = scene.state.body;

    applyDashboardSpec({ scene, spec: makeSpec('New title'), description: 'Apply spec', scope: 'code-pane' });

    expect(scene.state.title).toBe('New title');
    const newBody = scene.state.body;
    expect(newBody).not.toBe(originalBody);

    scene.state.sidebar.undoAction();
    expect(scene.state.title).toBe('Old title');
    expect(scene.state.body).toBe(originalBody);

    scene.state.sidebar.redoAction();
    expect(scene.state.title).toBe('New title');
    expect(scene.state.body).toBe(newBody);

    scene.state.sidebar.undoAction();
    scene.state.sidebar.redoAction();
    expect(scene.state.title).toBe('New title');
    expect(scene.state.body).toBe(newBody);
  });

  it('re-publishes NewSceneObjectAddedEvent for the restored children on undo, so url sync re-attaches', () => {
    const scene = buildScene(makeSpec('Old title'));
    const originalBody = scene.state.body;

    applyDashboardSpec({ scene, spec: makeSpec('New title'), description: 'Apply spec', scope: 'code-pane' });

    const addedObjects: unknown[] = [];
    scene.subscribeToEvent(NewSceneObjectAddedEvent, (evt) => addedObjects.push(evt.payload));

    scene.state.sidebar.undoAction();

    expect(addedObjects).toContain(originalBody);
  });

  it('marks the scene dirty on perform, and restores the prior dirty state on undo', () => {
    const scene = buildScene(makeSpec('Old title'));
    expect(scene.state.isDirty).toBeFalsy();

    applyDashboardSpec({ scene, spec: makeSpec('New title'), description: 'Apply spec', scope: 'code-pane' });
    expect(scene.state.isDirty).toBe(true);

    scene.state.sidebar.undoAction();
    expect(scene.state.isDirty).toBeFalsy();
  });

  it('changes panels in rows to tabs, and undo/redo restore each layout', () => {
    const scene = buildScene(makeRowsSpec('Dashboard'));
    const rowsBody = scene.state.body;

    applyDashboardSpec({ scene, spec: makeTabsSpec('Dashboard'), description: 'Apply spec', scope: 'code-pane' });

    const tabsBody = scene.state.body;
    expect(tabsBody).not.toBe(rowsBody);
    expect(tabsBody).toBeInstanceOf(TabsLayoutManager);
    expect((tabsBody as TabsLayoutManager).state.tabs).toHaveLength(2);

    scene.state.sidebar.undoAction();
    expect(scene.state.body).toBe(rowsBody);
    expect(scene.state.body).toBeInstanceOf(RowsLayoutManager);

    scene.state.sidebar.redoAction();
    expect(scene.state.body).toBe(tabsBody);
    expect(scene.state.body).toBeInstanceOf(TabsLayoutManager);
  });

  it('recreates the code pane on apply, undo, and redo so it reloads the current spec', () => {
    const scene = buildScene(makeRowsSpec('Dashboard'));

    scene.state.sidebar.openPane(new DashboardCodePane({}));
    const originalPane = scene.state.sidebar.state.openPane!;
    expect(originalPane.getId()).toBe('code');

    applyDashboardSpec({ scene, spec: makeRowsSpec('Dashboard'), description: 'Apply spec', scope: 'code-pane' });

    const appliedPane = scene.state.sidebar.state.openPane!;
    expect(appliedPane.getId()).toBe('code');
    expect(appliedPane).not.toBe(originalPane);

    scene.state.sidebar.undoAction();
    const restoredPane = scene.state.sidebar.state.openPane!;
    expect(restoredPane.getId()).toBe('code');
    expect(restoredPane).not.toBe(appliedPane);

    scene.state.sidebar.redoAction();
    expect(scene.state.sidebar.state.openPane?.getId()).toBe('code');
    expect(scene.state.sidebar.state.openPane).not.toBe(restoredPane);
  });

  it('closes an open pane even when there is no selection', () => {
    const scene = buildScene(makeSpec('Old title'));
    const addNewPane = new AddNewPane({});
    scene.state.sidebar.openPane(addNewPane);
    expect(scene.state.sidebar.state.openPane).toBe(addNewPane);
    expect(scene.state.sidebar.state.selectionContext.selected).toHaveLength(0);

    applyDashboardSpec({ scene, spec: makeSpec('New title'), description: 'Apply spec', scope: 'code-pane' });

    expect(scene.state.sidebar.state.openPane).toBeUndefined();
  });

  it('rebinds panel selection by ID across layouts on apply, undo, and redo', () => {
    const scene = buildScene(makeRowsSpec('Dashboard'));
    const sidebar = scene.state.sidebar;
    sidebar.selectObject(findVizPanelByKey(scene, 'panel-1')!);
    const originalSelection = sidebar.state.selectionContext.selected;
    const originalPane = sidebar.state.openPane!;
    const originalPanel = sidebar.getSelectedObject();

    applyDashboardSpec({ scene, spec: makeTabsSpec('Dashboard'), description: 'Apply spec', scope: 'code-pane' });

    const appliedPanel = findVizPanelByKey(scene, 'panel-1')!;
    expect(sidebar.state.selectionContext.selected).toEqual([{ id: 'panel-1' }]);
    expect(sidebar.state.selectionContext.selected).not.toBe(originalSelection);
    expect(sidebar.state.openPane?.getId()).toBe('element');
    expect(sidebar.state.openPane).not.toBe(originalPane);
    expect(sidebar.getSelectedObject()).toBe(appliedPanel);
    expect(sidebar.getSelectedObject()).not.toBe(originalPanel);
    expect(sidebar.state.previousState).toBeUndefined();

    sidebar.undoAction();
    expect(sidebar.getSelectedObject()).toBe(originalPanel);
    expect(sidebar.state.openPane?.getId()).toBe('element');

    sidebar.redoAction();
    expect(sidebar.getSelectedObject()).toBe(appliedPanel);
    expect(sidebar.state.openPane?.getId()).toBe('element');
  });

  it('closes the pane when a selected ID no longer exists', () => {
    const scene = buildScene(makeRowsSpec('Dashboard'));
    const sidebar = scene.state.sidebar;
    sidebar.selectObject(findVizPanelByKey(scene, 'panel-1')!);
    expect(sidebar.state.openPane?.getId()).toBe('element');

    applyDashboardSpec({ scene, spec: makeSpec('Empty dashboard'), description: 'Apply spec', scope: 'code-pane' });

    expect(sidebar.state.selectionContext.selected).toEqual([]);
    expect(sidebar.state.openPane).toBeUndefined();
    expect(sidebar.state.previousState).toBeUndefined();
  });

  it('applies title edits to the current panel after a rebuild', () => {
    const scene = buildScene(makeRowsSpec('Dashboard'));
    const sidebar = scene.state.sidebar;
    const originalPanel = findVizPanelByKey(scene, 'panel-1')!;
    sidebar.selectObject(originalPanel);

    applyDashboardSpec({ scene, spec: makeTabsSpec('Dashboard'), description: 'Apply spec', scope: 'code-pane' });
    getEditableElementFor(sidebar.getSelectedObject())!.onChangeName!('Renamed after rebuild');

    expect(findVizPanelByKey(scene, 'panel-1')!.state.title).toBe('Renamed after rebuild');
    expect(originalPanel.state.title).toBe('Panel 1');
  });

  it('preserves multiple selected IDs and closes the pane if any selected panel is removed', () => {
    const scene = buildScene(makeRowsSpec('Dashboard'));
    const sidebar = scene.state.sidebar;
    sidebar.selectObject(findVizPanelByKey(scene, 'panel-1')!);
    sidebar.selectObject(findVizPanelByKey(scene, 'panel-2')!, { multi: true });

    applyDashboardSpec({ scene, spec: makeTabsSpec('Dashboard'), description: 'Apply spec', scope: 'code-pane' });
    expect(sidebar.state.selectionContext.selected).toEqual([{ id: 'panel-1' }, { id: 'panel-2' }]);
    expect(sidebar.state.openPane?.getId()).toBe('element');

    const spec = makeRowsSpec('Dashboard');
    delete spec.elements['panel-2'];
    spec.layout = { kind: 'GridLayout', spec: { items: [gridItem('panel-1')] } };
    sidebar.setState({ isDocked: true });
    applyDashboardSpec({ scene, spec, description: 'Remove panel', scope: 'code-pane' });

    expect(sidebar.state.selectionContext.selected).toEqual([]);
    expect(sidebar.state.openPane).toBeUndefined();
  });

  describe('with url sync', () => {
    let deactivate: Array<() => void> = [];

    /** Opens the dashboard with `search` as its URL and lets the variables settle. */
    async function open(spec: DashboardV2Spec, search: string) {
      locationService.replace({ search });
      const scene = buildScene(spec);
      new UrlSyncManager().initSync(scene);
      await activateVariables(scene);
      return scene;
    }

    async function activateVariables(scene: DashboardScene) {
      // The dashboard set and each section set, as rendering would activate them.
      for (const obj of [scene, ...sceneGraph.findAllObjects(scene, (o) => Boolean(o.state.$variables))]) {
        const set = obj.state.$variables!;
        if (!set.isActive) {
          deactivate.push(set.activate());
        }
      }
      await settle();
    }

    async function apply(scene: DashboardScene, spec: DashboardV2Spec) {
      applyDashboardSpec({ scene, spec, description: 'Apply spec', scope: 'code-pane' });
      await activateVariables(scene);
    }

    afterEach(() => {
      deactivate.reverse().forEach((fn) => fn());
      deactivate = [];
      jest.restoreAllMocks();
    });

    it('keeps the variable values the spec sets instead of reading the previous ones back from the URL', async () => {
      const scene = await open(makeSyncedSpec(), 'var-namespace=a&var-service=$__all');

      await apply(scene, makeSyncedSpec({ namespace: 'b', service: 'y' }));

      expect(value(scene, 'namespace')).toBe('b');
      expect(value(scene, 'service')).toEqual(['y']);
      expect(url().get('var-namespace')).toBe('b');
      expect(url().getAll('var-service')).toEqual(['y']);
    });

    it('keeps a section variable value the spec sets', async () => {
      const scene = await open(makeSyncedSpec({ sections: ['a'] }), 'var-namespace=a&var-service=$__all&var-pod=a');

      await apply(scene, makeSyncedSpec({ sections: ['x'] }));

      expect(value(scene, 'pod')).toBe('x');
      expect(url().get('var-pod')).toBe('x');
    });

    it('restores the previous variable values, and the URL, on undo', async () => {
      const scene = await open(makeSyncedSpec({ service: 'x' }), 'var-namespace=a&var-service=x');

      await apply(scene, makeSyncedSpec({ namespace: 'b', service: 'y' }));
      scene.state.sidebar.undoAction();
      await settle();

      expect(value(scene, 'namespace')).toBe('a');
      expect(value(scene, 'service')).toEqual(['x']);
      expect(url().get('var-namespace')).toBe('a');
      expect(url().getAll('var-service')).toEqual(['x']);
    });

    it('does not add a variable key the URL did not hold', async () => {
      const scene = await open(makeSyncedSpec(), 'var-namespace=a');
      // Url sync writes every variable once its options load, so drop the key after that.
      locationService.partial({ 'var-service': null }, true);

      applyDashboardSpec({
        scene,
        spec: makeSyncedSpec({ service: 'y' }),
        description: 'Apply spec',
        scope: 'code-pane',
      });

      expect(url().has('var-service')).toBe(false);
      await activateVariables(scene);
      expect(value(scene, 'service')).toEqual(['y']);
    });

    it('leaves the URL alone when the spec changes no variable', async () => {
      const scene = await open(makeSyncedSpec(), 'var-namespace=a&var-service=$__all');
      const partial = jest.spyOn(locationService, 'partial');

      await apply(scene, makeSyncedSpec({ title: 'Renamed' }));

      expect(partial).not.toHaveBeenCalled();
    });

    it('keeps a changed ad hoc default filter across an apply that does not touch it', async () => {
      const scene = await open(
        makeSyncedSpec({ adhoc: 'prod' }),
        'var-namespace=a&var-service=$__all&var-filters=env|=|staging%23dashboard%23restorable'
      );
      const filterValue = () => lookup<AdHocFiltersVariable>(scene, 'filters').state.originFilters?.[0]?.value;
      expect(filterValue()).toBe('staging');

      await apply(scene, makeSyncedSpec({ adhoc: 'prod', title: 'Renamed' }));

      expect(filterValue()).toBe('staging');
      expect(url().getAll('var-filters')).toEqual(['env|=|staging#dashboard#restorable']);
    });

    it('keeps the values the spec sets for a variable name more than one section uses', async () => {
      const scene = await open(
        makeSyncedSpec({ sections: ['a', 'b'] }),
        'var-namespace=a&var-service=$__all&var-pod=a&var-pod-2=b'
      );

      await apply(scene, makeSyncedSpec({ sections: ['x', 'y'] }));

      const pods = sceneGraph
        .findAllObjects(scene, (obj) => 'name' in obj.state && obj.state.name === 'pod')
        .map((obj) => (obj as MultiValueVariable).getValue());
      expect(pods).toEqual(['x', 'y']);
      expect([url().get('var-pod'), url().get('var-pod-2')]).toEqual(['x', 'y']);
    });

    it('keeps the selected tab across an apply that renames the first tab', async () => {
      const scene = await open(makeSyncedSpec({ tabs: ['One', 'Two'] }), 'var-namespace=a&var-service=$__all&dtab=two');

      await apply(scene, makeSyncedSpec({ tabs: ['First', 'Two'] }));

      expect(url().get('dtab')).toBe('two');
    });

    it('keeps the selected tab across an apply that inserts a tab before it and changes a variable', async () => {
      const scene = await open(makeSyncedSpec({ tabs: ['One', 'Two'] }), 'var-namespace=a&var-service=$__all&dtab=two');

      await apply(scene, makeSyncedSpec({ namespace: 'b', tabs: ['Zero', 'One', 'Two'] }));

      expect(url().get('dtab')).toBe('two');
      expect(value(scene, 'namespace')).toBe('b');
    });

    it('keeps the spec value of the remaining section when the spec removes a section sharing its variable name', async () => {
      const scene = await open(
        makeSyncedSpec({ sections: ['a', 'b'] }),
        'var-namespace=a&var-service=$__all&var-pod=a&var-pod-2=b'
      );

      await apply(scene, makeSyncedSpec({ sections: ['y'] }));

      const pods = sceneGraph
        .findAllObjects(scene, (obj) => 'name' in obj.state && obj.state.name === 'pod')
        .map((obj) => (obj as MultiValueVariable).getValue());
      expect(pods).toEqual(['y']);
    });

    it('keeps a value the user picked after the apply when undoing an apply that did not touch the variable', async () => {
      const scene = await open(makeSyncedSpec(), 'var-namespace=a&var-service=$__all');

      await apply(scene, makeSyncedSpec({ title: 'Renamed' }));
      lookup<MultiValueVariable>(scene, 'namespace').changeValueTo('x');
      await settle();
      scene.state.sidebar.undoAction();
      await settle();

      expect(value(scene, 'namespace')).toBe('x');
      expect(url().get('var-namespace')).toBe('x');
    });

    it('writes the spec value on redo over a value the user picked after the undo', async () => {
      const scene = await open(makeSyncedSpec(), 'var-namespace=a&var-service=$__all');

      await apply(scene, makeSyncedSpec({ namespace: 'b' }));
      scene.state.sidebar.undoAction();
      await settle();
      lookup<MultiValueVariable>(scene, 'namespace').changeValueTo('x');
      await settle();
      scene.state.sidebar.redoAction();
      await settle();

      expect(value(scene, 'namespace')).toBe('b');
      expect(url().get('var-namespace')).toBe('b');
    });

    describe('time settings', () => {
      const before = { from: 'now-6h', to: 'now', timezone: 'utc', autoRefresh: '1m' };
      const after = { from: 'now-24h', to: 'now', timezone: 'browser', autoRefresh: '30s' };
      const timeSearch = 'from=now-6h&to=now&timezone=utc&refresh=1m';

      const timeSettings = (scene: DashboardScene) => {
        const { from, to, timeZone } = sceneGraph.getTimeRange(scene).state;
        return { from, to, timezone: timeZone, autoRefresh: scene.state.controls?.state.refreshPicker.state.refresh };
      };
      const timeUrl = () => ({
        from: url().get('from'),
        to: url().get('to'),
        timezone: url().get('timezone'),
        autoRefresh: url().get('refresh'),
      });

      it('keeps the time range, timezone and refresh the spec sets instead of reading the previous ones back from the URL', async () => {
        const scene = await open(makeSyncedSpec({ time: before }), timeSearch);

        await apply(scene, makeSyncedSpec({ time: after }));

        expect(timeSettings(scene)).toEqual(after);
        expect(timeUrl()).toEqual(after);
      });

      it('restores the previous time settings, and the URL, on undo', async () => {
        const scene = await open(makeSyncedSpec({ time: before }), timeSearch);

        await apply(scene, makeSyncedSpec({ time: after }));
        scene.state.sidebar.undoAction();
        await settle();

        expect(timeSettings(scene)).toEqual(before);
        expect(timeUrl()).toEqual(before);
      });

      it('keeps a time range the user zoomed to in the URL when the spec carries it unchanged', async () => {
        const zoomed = { ...before, from: 'now-1h' };
        const scene = await open(makeSyncedSpec({ time: before }), 'from=now-1h&to=now&timezone=utc&refresh=1m');
        const partial = jest.spyOn(locationService, 'partial');

        // A spec read back from the open dashboard carries its live time range.
        await apply(scene, makeSyncedSpec({ time: zoomed, title: 'Renamed' }));

        expect(partial).not.toHaveBeenCalled();
        expect(timeSettings(scene)).toEqual(zoomed);
      });

      it('re-applies the spec time settings on redo', async () => {
        const scene = await open(makeSyncedSpec({ time: before }), timeSearch);

        await apply(scene, makeSyncedSpec({ time: after }));
        scene.state.sidebar.undoAction();
        await settle();
        scene.state.sidebar.redoAction();
        await settle();

        expect(timeSettings(scene)).toEqual(after);
        expect(timeUrl()).toEqual(after);
      });

      it('drops `time` and `time.window` from the URL when the spec changes the time range', async () => {
        const scene = await open(makeSyncedSpec({ time: before }), 'time=1700000000000&time.window=3600000');

        await apply(scene, makeSyncedSpec({ time: { ...before, from: 'now-24h' } }));

        expect(sceneGraph.getTimeRange(scene).state.from).toBe('now-24h');
        expect(url().has('time')).toBe(false);
        expect(url().has('time.window')).toBe(false);
      });
    });

    describe('reading the previous spec off the dashboard', () => {
      it('is skipped when the URL agrees with the spec the apply sets', async () => {
        const scene = await open(makeSyncedSpec(), 'var-namespace=a&var-service=$__all');
        mockSerializeCount = 0;

        await apply(scene, makeSyncedSpec({ title: 'Renamed' }));

        expect(mockSerializeCount).toBe(0);
        expect(scene.state.title).toBe('Renamed');
      });

      it('happens once when the URL holds a value the spec changes, and is reused by undo and redo', async () => {
        const scene = await open(makeSyncedSpec(), 'var-namespace=a&var-service=$__all');
        mockSerializeCount = 0;

        await apply(scene, makeSyncedSpec({ namespace: 'b' }));
        expect(mockSerializeCount).toBe(1);

        scene.state.sidebar.undoAction();
        await settle();
        scene.state.sidebar.redoAction();
        await settle();

        expect(mockSerializeCount).toBe(1);
        expect(value(scene, 'namespace')).toBe('b');
        expect(url().get('var-namespace')).toBe('b');
      });

      it('happens on undo, off the restored dashboard, when the apply skipped it', async () => {
        const scene = await open(makeSyncedSpec(), 'var-namespace=a&var-service=$__all');
        mockSerializeCount = 0;

        await apply(scene, makeSyncedSpec({ title: 'Renamed' }));
        lookup<MultiValueVariable>(scene, 'namespace').changeValueTo('x');
        await settle();
        scene.state.sidebar.undoAction();
        await settle();

        // The restored dashboard holds `a` while the URL holds the user's `x`, so the undo has to
        // know whether the apply changed `namespace`. It did not, so the user's value stays.
        expect(mockSerializeCount).toBe(1);
        expect(scene.state.title).toBe('Variables');
        expect(value(scene, 'namespace')).toBe('x');
      });
    });
  });
});
