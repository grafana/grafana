/**
 * applyDashboardSpec re-syncs the rebuilt scene from the URL so url-only state survives the swap.
 * These cover how that re-sync treats variable values, which are url-synced but also carried by
 * the spec. Kept apart from applyDashboardSpec.test.ts because query variables need a mocked
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
}: {
  title?: string;
  namespace?: string;
  service?: string;
  /** One row per entry, each with a `pod` section variable set to that value. */
  sections?: string[];
  adhoc?: string;
} = {}): DashboardV2Spec {
  const spec: DashboardV2Spec = {
    ...defaultDashboardV2Spec(),
    title,
    elements: {},
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
    applyDashboardSpec({ scene, spec, description: 'Apply spec' });
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

    applyDashboardSpec({ scene, spec: makeSpec({ service: 'y' }), description: 'Apply spec' });

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
});
