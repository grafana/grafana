/**
 * applyDashboardSpec re-syncs the rebuilt scene from the URL so url-only state survives the swap.
 * These cover how that re-sync treats variable values and time settings, which are url-synced but
 * also carried by the spec. Kept apart from applyDashboardSpec.test.ts because query variables need a mocked
 * datasource and runner.
 */
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
  sceneGraph,
  UrlSyncManager,
  type SceneObject,
} from '@grafana/scenes';
import {
  defaultAdhocVariableKind,
  defaultQueryVariableKind,
  defaultSpec as defaultDashboardV2Spec,
  type Spec as DashboardV2Spec,
  type VariableKind,
} from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { type DashboardWithAccessInfo } from 'app/features/dashboard/api/types';

import { type DashboardScene } from '../../scene/DashboardScene';
import { transformSaveModelSchemaV2ToScene } from '../../serialization/transformSaveModelSchemaV2ToScene';

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

function makeSpec({
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

function buildScene(spec: DashboardV2Spec): DashboardScene {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal resource envelope for the test
  const dto = {
    kind: 'DashboardWithAccessInfo',
    apiVersion: 'dashboard.grafana.app/v2beta1',
    metadata: { name: 'dash-1', generation: 1, creationTimestamp: '2026-08-03T00:00:00Z', annotations: {} },
    access: { canEdit: true, canSave: true, canShare: true, canStar: true, canDelete: true, canAdmin: true },
    spec: cloneDeep(spec),
  } as unknown as DashboardWithAccessInfo<DashboardV2Spec>;

  const scene = transformSaveModelSchemaV2ToScene(dto);
  scene.state.sidebar.activate();
  scene.setState({ isEditing: true });
  return scene;
}

function lookup<T extends SceneObject>(scene: DashboardScene, name: string): T {
  const variable = sceneGraph.findObject(scene, (obj) => 'name' in obj.state && obj.state.name === name);
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the test variables are known by name
  return variable as T;
}

const value = (scene: DashboardScene, name: string) => lookup<MultiValueVariable>(scene, name).getValue();
const url = () => new URLSearchParams(locationService.getLocation().search);
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('applyDashboardSpec with url sync', () => {
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
    const scene = await open(makeSpec(), 'var-namespace=a&var-service=$__all');

    await apply(scene, makeSpec({ namespace: 'b', service: 'y' }));

    expect(value(scene, 'namespace')).toBe('b');
    expect(value(scene, 'service')).toEqual(['y']);
    expect(url().get('var-namespace')).toBe('b');
    expect(url().getAll('var-service')).toEqual(['y']);
  });

  it('keeps a section variable value the spec sets', async () => {
    const scene = await open(makeSpec({ sections: ['a'] }), 'var-namespace=a&var-service=$__all&var-pod=a');

    await apply(scene, makeSpec({ sections: ['x'] }));

    expect(value(scene, 'pod')).toBe('x');
    expect(url().get('var-pod')).toBe('x');
  });

  it('restores the previous variable values, and the URL, on undo', async () => {
    const scene = await open(makeSpec({ service: 'x' }), 'var-namespace=a&var-service=x');

    await apply(scene, makeSpec({ namespace: 'b', service: 'y' }));
    scene.state.sidebar.undoAction();
    await settle();

    expect(value(scene, 'namespace')).toBe('a');
    expect(value(scene, 'service')).toEqual(['x']);
    expect(url().get('var-namespace')).toBe('a');
    expect(url().getAll('var-service')).toEqual(['x']);
  });

  it('does not add a variable key the URL did not hold', async () => {
    const scene = await open(makeSpec(), 'var-namespace=a');
    // Url sync writes every variable once its options load, so drop the key after that.
    locationService.partial({ 'var-service': null }, true);

    applyDashboardSpec({ scene, spec: makeSpec({ service: 'y' }), description: 'Apply spec', scope: 'code-pane' });

    expect(url().has('var-service')).toBe(false);
    await activateVariables(scene);
    expect(value(scene, 'service')).toEqual(['y']);
  });

  it('leaves the URL alone when the spec changes no variable', async () => {
    const scene = await open(makeSpec(), 'var-namespace=a&var-service=$__all');
    const partial = jest.spyOn(locationService, 'partial');

    await apply(scene, makeSpec({ title: 'Renamed' }));

    expect(partial).not.toHaveBeenCalled();
  });

  it('keeps a changed ad hoc default filter across an apply that does not touch it', async () => {
    const scene = await open(
      makeSpec({ adhoc: 'prod' }),
      'var-namespace=a&var-service=$__all&var-filters=env|=|staging%23dashboard%23restorable'
    );
    const filterValue = () => lookup<AdHocFiltersVariable>(scene, 'filters').state.originFilters?.[0]?.value;
    expect(filterValue()).toBe('staging');

    await apply(scene, makeSpec({ adhoc: 'prod', title: 'Renamed' }));

    expect(filterValue()).toBe('staging');
    expect(url().getAll('var-filters')).toEqual(['env|=|staging#dashboard#restorable']);
  });

  it('keeps the values the spec sets for a variable name more than one section uses', async () => {
    const scene = await open(
      makeSpec({ sections: ['a', 'b'] }),
      'var-namespace=a&var-service=$__all&var-pod=a&var-pod-2=b'
    );

    await apply(scene, makeSpec({ sections: ['x', 'y'] }));

    const pods = sceneGraph
      .findAllObjects(scene, (obj) => 'name' in obj.state && obj.state.name === 'pod')
      .map((obj) => (obj as MultiValueVariable).getValue());
    expect(pods).toEqual(['x', 'y']);
    expect([url().get('var-pod'), url().get('var-pod-2')]).toEqual(['x', 'y']);
  });

  it('keeps the selected tab across an apply that renames the first tab', async () => {
    const scene = await open(makeSpec({ tabs: ['One', 'Two'] }), 'var-namespace=a&var-service=$__all&dtab=two');

    await apply(scene, makeSpec({ tabs: ['First', 'Two'] }));

    expect(url().get('dtab')).toBe('two');
  });

  it('keeps the selected tab across an apply that inserts a tab before it and changes a variable', async () => {
    const scene = await open(makeSpec({ tabs: ['One', 'Two'] }), 'var-namespace=a&var-service=$__all&dtab=two');

    await apply(scene, makeSpec({ namespace: 'b', tabs: ['Zero', 'One', 'Two'] }));

    expect(url().get('dtab')).toBe('two');
    expect(value(scene, 'namespace')).toBe('b');
  });

  it('keeps the spec value of the remaining section when the spec removes a section sharing its variable name', async () => {
    const scene = await open(
      makeSpec({ sections: ['a', 'b'] }),
      'var-namespace=a&var-service=$__all&var-pod=a&var-pod-2=b'
    );

    await apply(scene, makeSpec({ sections: ['y'] }));

    const pods = sceneGraph
      .findAllObjects(scene, (obj) => 'name' in obj.state && obj.state.name === 'pod')
      .map((obj) => (obj as MultiValueVariable).getValue());
    expect(pods).toEqual(['y']);
  });

  it('keeps a value the user picked after the apply when undoing an apply that did not touch the variable', async () => {
    const scene = await open(makeSpec(), 'var-namespace=a&var-service=$__all');

    await apply(scene, makeSpec({ title: 'Renamed' }));
    lookup<MultiValueVariable>(scene, 'namespace').changeValueTo('x');
    await settle();
    scene.state.sidebar.undoAction();
    await settle();

    expect(value(scene, 'namespace')).toBe('x');
    expect(url().get('var-namespace')).toBe('x');
  });

  it('writes the spec value on redo over a value the user picked after the undo', async () => {
    const scene = await open(makeSpec(), 'var-namespace=a&var-service=$__all');

    await apply(scene, makeSpec({ namespace: 'b' }));
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
      const scene = await open(makeSpec({ time: before }), timeSearch);

      await apply(scene, makeSpec({ time: after }));

      expect(timeSettings(scene)).toEqual(after);
      expect(timeUrl()).toEqual(after);
    });

    it('restores the previous time settings, and the URL, on undo', async () => {
      const scene = await open(makeSpec({ time: before }), timeSearch);

      await apply(scene, makeSpec({ time: after }));
      scene.state.sidebar.undoAction();
      await settle();

      expect(timeSettings(scene)).toEqual(before);
      expect(timeUrl()).toEqual(before);
    });

    it('keeps a time range the user zoomed to in the URL when the spec carries it unchanged', async () => {
      const zoomed = { ...before, from: 'now-1h' };
      const scene = await open(makeSpec({ time: before }), 'from=now-1h&to=now&timezone=utc&refresh=1m');
      const partial = jest.spyOn(locationService, 'partial');

      // A spec read back from the open dashboard carries its live time range.
      await apply(scene, makeSpec({ time: zoomed, title: 'Renamed' }));

      expect(partial).not.toHaveBeenCalled();
      expect(timeSettings(scene)).toEqual(zoomed);
    });

    it('re-applies the spec time settings on redo', async () => {
      const scene = await open(makeSpec({ time: before }), timeSearch);

      await apply(scene, makeSpec({ time: after }));
      scene.state.sidebar.undoAction();
      await settle();
      scene.state.sidebar.redoAction();
      await settle();

      expect(timeSettings(scene)).toEqual(after);
      expect(timeUrl()).toEqual(after);
    });

    it('drops `time` and `time.window` from the URL when the spec changes the time range', async () => {
      const scene = await open(makeSpec({ time: before }), 'time=1700000000000&time.window=3600000');

      await apply(scene, makeSpec({ time: { ...before, from: 'now-24h' } }));

      expect(sceneGraph.getTimeRange(scene).state.from).toBe('now-24h');
      expect(url().has('time')).toBe(false);
      expect(url().has('time.window')).toBe(false);
    });
  });

  describe('reading the previous spec off the dashboard', () => {
    it('is skipped when the URL agrees with the spec the apply sets', async () => {
      const scene = await open(makeSpec(), 'var-namespace=a&var-service=$__all');
      mockSerializeCount = 0;

      await apply(scene, makeSpec({ title: 'Renamed' }));

      expect(mockSerializeCount).toBe(0);
      expect(scene.state.title).toBe('Renamed');
    });

    it('happens once when the URL holds a value the spec changes, and is reused by undo and redo', async () => {
      const scene = await open(makeSpec(), 'var-namespace=a&var-service=$__all');
      mockSerializeCount = 0;

      await apply(scene, makeSpec({ namespace: 'b' }));
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
      const scene = await open(makeSpec(), 'var-namespace=a&var-service=$__all');
      mockSerializeCount = 0;

      await apply(scene, makeSpec({ title: 'Renamed' }));
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
