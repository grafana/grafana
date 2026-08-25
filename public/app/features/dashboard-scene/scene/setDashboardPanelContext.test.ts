import { waitFor } from '@testing-library/react';

import {
  type AdHocVariableModel,
  CoreApp,
  EventBusSrv,
  getDefaultTimeRange,
  type GroupByVariableModel,
  LoadingState,
  type Scope,
  standardTransformersRegistry,
  toDataFrame,
  type VariableModel,
} from '@grafana/data';
import { type BackendSrv, config, setBackendSrv } from '@grafana/runtime';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import {
  GroupByVariable,
  SceneDataNode,
  type SceneDataTransformer,
  sceneGraph,
  SceneObjectStateChangedEvent,
  SceneQueryRunner,
} from '@grafana/scenes';
import { type DataTransformerConfig } from '@grafana/schema';
import { type AdHocFilterItem, type PanelContext } from '@grafana/ui';
import { getStandardTransformers } from 'app/features/transformers/standardTransformers';

import { isAnnotationApiAvailable } from '../../annotations/isAnnotationApiAvailable';
import { buildPanelEditScene } from '../panel-edit/PanelEditor';
import { DashboardSceneChangeTracker } from '../saving/DashboardSceneChangeTracker';
import { transformSaveModelToScene } from '../serialization/transformSaveModelToScene';
import { transformSceneToSaveModel } from '../serialization/transformSceneToSaveModel';
import { activateFullSceneTree } from '../utils/test-utils';
import { findVizPanelByKey, getDataTransformerFor, getQueryRunnerFor } from '../utils/utils';

import { getAdHocFilterVariableFor, setDashboardPanelContext } from './setDashboardPanelContext';

jest.mock('../../annotations/isAnnotationApiAvailable');
jest.mock('@grafana/runtime/internal', () => ({
  ...jest.requireActual('@grafana/runtime/internal'),
  getFeatureFlagClient: jest.fn(),
  getDatasourcePluginMeta: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstance: jest.fn().mockResolvedValue({ uid: 'my-ds-uid', type: 'prometheus' }),
  getDataSourceInstanceSettings: jest.fn().mockResolvedValue(undefined),
}));

const mockIsAnnotationApiAvailable = jest.mocked(isAnnotationApiAvailable);
const mockGetFeatureFlagClient = jest.mocked(getFeatureFlagClient);
const getBooleanValueFn = jest.fn();

function stubFFEnabled(enabled: boolean) {
  getBooleanValueFn.mockImplementation((key: string, defaultValue: boolean) =>
    key === FlagKeys.GrafanaKubernetesAnnotationsClient ? enabled : defaultValue
  );
}

const postFn = jest.fn();
const putFn = jest.fn();
const patchFn = jest.fn();
const deleteFn = jest.fn();
const getFn = jest.fn();

setBackendSrv({
  post: postFn,
  put: putFn,
  patch: patchFn,
  delete: deleteFn,
  get: getFn,
} as unknown as BackendSrv);
mockGetFeatureFlagClient.mockReturnValue({ getBooleanValue: getBooleanValueFn } as unknown as ReturnType<
  typeof getFeatureFlagClient
>);

beforeEach(() => {
  postFn.mockReset();
  putFn.mockReset();
  patchFn.mockReset();
  deleteFn.mockReset();
  getFn.mockReset();
  mockIsAnnotationApiAvailable.mockReset();
  getBooleanValueFn.mockReset();
  stubFFEnabled(false);
});

describe('setDashboardPanelContext', () => {
  describe('app', () => {
    it('Is PanelEditor while the panel edit pane is open', () => {
      const { scene, vizPanel, context } = buildTestScene({});

      expect(context.app).toBe(CoreApp.Dashboard);

      scene.onEnterEditMode();
      scene.setState({ editPanel: buildPanelEditScene(vizPanel) });

      expect(context.app).toBe(CoreApp.PanelEditor);
    });

    it('Still tracks the panel edit pane after the scene is deactivated and reactivated', async () => {
      // Activating the scene resolves the panel datasource, which this suite does not register.
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const { scene, vizPanel, context } = buildTestScene({});

      // Navigating away leaves the scene in the page cache, so the same context object is reused.
      scene.activate()();
      const deactivate = scene.activate();

      scene.onEnterEditMode();
      scene.setState({ editPanel: buildPanelEditScene(vizPanel) });

      expect(context.app).toBe(CoreApp.PanelEditor);

      deactivate();
      await new Promise((resolve) => setTimeout(resolve, 1));
      warnSpy.mockRestore();
    });
  });

  describe('canAddAnnotations', () => {
    it('Can add when builtIn is enabled and permissions allow', () => {
      const { context } = buildTestScene({ builtInAnnotationsEnabled: true, dashboardCanEdit: true, canAdd: true });
      expect(context.canAddAnnotations!()).toBe(true);
    });

    it('Can not when builtIn is disabled', () => {
      const { context } = buildTestScene({ builtInAnnotationsEnabled: false, dashboardCanEdit: true, canAdd: true });
      expect(context.canAddAnnotations!()).toBe(false);
    });

    it('Can not when permission do not allow', () => {
      const { context } = buildTestScene({ builtInAnnotationsEnabled: true, dashboardCanEdit: true, canAdd: false });
      expect(context.canAddAnnotations!()).toBe(false);
    });
  });

  describe('canEditAnnotations', () => {
    it('Can edit global event when user has org permission', () => {
      const { context } = buildTestScene({ canEdit: true });
      expect(context.canEditAnnotations!()).toBe(true);
    });

    it('Can not edit global event when has no org permission', () => {
      const { context } = buildTestScene({ canEdit: false });
      expect(context.canEditAnnotations!()).toBe(false);
    });

    it('Can edit dashboard event when has dashboard permission', () => {
      const { context } = buildTestScene({ canEdit: true });
      expect(context.canEditAnnotations!('dash-uid')).toBe(true);
    });

    it('Can not edit dashboard event when has no dashboard permission', () => {
      const { context } = buildTestScene({ dashboardCanEdit: true, canEdit: false });
      expect(context.canEditAnnotations!('dash-uid')).toBe(false);
    });
  });

  describe('canDeleteAnnotations', () => {
    it('Can delete global event when user has org permission', () => {
      const { context } = buildTestScene({ dashboardCanEdit: true, canDelete: true });
      expect(context.canDeleteAnnotations!()).toBe(true);
    });

    it('Can not delete global event when has no org permission', () => {
      const { context } = buildTestScene({ dashboardCanEdit: true, canDelete: false });
      expect(context.canDeleteAnnotations!()).toBe(false);
    });

    it('Can delete dashboard event when has dashboard permission', () => {
      const { context } = buildTestScene({ dashboardCanEdit: true, canDelete: true });
      expect(context.canDeleteAnnotations!('dash-uid')).toBe(true);
    });

    it('Can not delete dashboard event when has no dashboard permission', () => {
      const { context } = buildTestScene({ dashboardCanEdit: true, canDelete: false });
      expect(context.canDeleteAnnotations!('dash-uid')).toBe(false);
    });
  });

  describe('onAnnotationCreate', () => {
    it('should create annotation', async () => {
      const { context } = buildTestScene({ dashboardCanEdit: true, canAdd: true });

      await context.onAnnotationCreate!({ from: 100, to: 200, description: 'save it', tags: [] });

      expect(postFn).toHaveBeenCalledWith('/api/annotations', {
        dashboardUID: 'dash-1',
        isRegion: true,
        panelId: 4,
        tags: [],
        text: 'save it',
        time: 100,
        timeEnd: 200,
      });
    });

    it('should POST to the k8s endpoint when the k8s annotation client is enabled and the API is discovered', async () => {
      stubFFEnabled(true);
      config.namespace = 'stack-1';
      mockIsAnnotationApiAvailable.mockResolvedValue(true);
      postFn.mockResolvedValue({});

      const { context } = buildTestScene({ dashboardCanEdit: true, canAdd: true });

      await context.onAnnotationCreate!({ from: 100, to: 200, description: 'save it', tags: ['t'] });

      expect(postFn).toHaveBeenCalledWith(
        '/apis/annotation.grafana.app/v0alpha1/namespaces/stack-1/annotations',
        expect.objectContaining({
          kind: 'Annotation',
          spec: expect.objectContaining({
            dashboardUID: 'dash-1',
            panelID: 4,
            text: 'save it',
            time: 100,
            timeEnd: 200,
            tags: ['t'],
          }),
        }),
        expect.anything()
      );
    });

    it('should include active scopes in k8s create request', async () => {
      stubFFEnabled(true);
      config.namespace = 'stack-1';
      mockIsAnnotationApiAvailable.mockResolvedValue(true);
      postFn.mockResolvedValue({});

      const mockScope: Scope = { metadata: { name: 'scope-a' }, spec: { title: 'Scope A' } };
      jest.spyOn(sceneGraph, 'getScopes').mockReturnValue([mockScope]);

      try {
        const { context } = buildTestScene({ dashboardCanEdit: true, canAdd: true });
        await context.onAnnotationCreate!({ from: 100, to: 200, description: 'with scope', tags: [] });

        const [, body] = postFn.mock.calls[0];
        expect(body.spec.scopes).toEqual(['scope-a']);
      } finally {
        jest.restoreAllMocks();
      }
    });
  });

  describe('onAnnotationUpdate', () => {
    it('should update annotation', async () => {
      const { context } = buildTestScene({ dashboardCanEdit: true, canAdd: true });

      await context.onAnnotationUpdate!({ from: 100, to: 200, id: 'event-id-123', description: 'updated', tags: [] });

      expect(putFn).toHaveBeenCalledWith('/api/annotations/event-id-123', {
        id: 'event-id-123',
        dashboardUID: 'dash-1',
        isRegion: true,
        panelId: 4,
        tags: [],
        text: 'updated',
        time: 100,
        timeEnd: 200,
      });
    });

    it('should PATCH the k8s endpoint when the k8s annotation client is enabled and the API is discovered', async () => {
      stubFFEnabled(true);
      config.namespace = 'stack-1';
      mockIsAnnotationApiAvailable.mockResolvedValue(true);
      patchFn.mockResolvedValue({});

      const { context } = buildTestScene({ dashboardCanEdit: true, canAdd: true });

      await context.onAnnotationUpdate!({ from: 100, to: 200, id: 'event-id-123', description: 'updated', tags: [] });

      expect(getFn).not.toHaveBeenCalled();
      expect(putFn).not.toHaveBeenCalled();
      expect(patchFn).toHaveBeenCalledWith(
        '/apis/annotation.grafana.app/v0alpha1/namespaces/stack-1/annotations/event-id-123',
        expect.objectContaining({
          spec: expect.objectContaining({ text: 'updated', time: 100, timeEnd: 200 }),
        }),
        expect.objectContaining({ headers: { 'Content-Type': 'application/merge-patch+json' } })
      );
    });

    it('should include active scopes in k8s update request', async () => {
      stubFFEnabled(true);
      config.namespace = 'stack-1';
      mockIsAnnotationApiAvailable.mockResolvedValue(true);
      patchFn.mockResolvedValue({});

      const mockScope: Scope = { metadata: { name: 'scope-b' }, spec: { title: 'Scope B' } };
      jest.spyOn(sceneGraph, 'getScopes').mockReturnValue([mockScope]);

      try {
        const { context } = buildTestScene({ dashboardCanEdit: true, canAdd: true });
        await context.onAnnotationUpdate!({
          from: 100,
          to: 200,
          id: 'event-id-123',
          description: 'scoped update',
          tags: [],
        });

        const [, body] = patchFn.mock.calls[0];
        expect(body.spec.scopes).toEqual(['scope-b']);
      } finally {
        jest.restoreAllMocks();
      }
    });
  });

  describe('onAnnotationDelete', () => {
    it('should update annotation', async () => {
      const { context } = buildTestScene({ dashboardCanEdit: true, canAdd: true });

      await context.onAnnotationDelete!('I-do-not-want-you');

      expect(deleteFn).toHaveBeenCalledWith('/api/annotations/I-do-not-want-you');
    });

    it('should DELETE the k8s resource when the k8s annotation client is enabled and the API is discovered', async () => {
      stubFFEnabled(true);
      config.namespace = 'stack-1';
      mockIsAnnotationApiAvailable.mockResolvedValue(true);
      deleteFn.mockResolvedValue({});

      const { context } = buildTestScene({ dashboardCanEdit: true, canAdd: true });

      // Bare numeric id from the legacy /api/annotations response — the k8s client
      // is responsible for prefixing it with "a-" before hitting the new endpoint.
      await context.onAnnotationDelete!('123');

      expect(deleteFn).toHaveBeenCalledWith(
        '/apis/annotation.grafana.app/v0alpha1/namespaces/stack-1/annotations/a-123',
        undefined,
        { showSuccessAlert: false }
      );
    });
  });

  describe('onAddAdHocFilter', () => {
    it('Should add new filter set', async () => {
      const { scene, context } = buildTestScene({});

      await context.onAddAdHocFilter!({ key: 'hello', value: 'world', operator: '!=' });
      await context.onAddAdHocFilter!({ key: 'hello', value: 'world2', operator: '!=' });

      const variable = await getAdHocFilterVariableFor(scene, { uid: 'my-ds-uid' });

      expect(variable.state.filters).toEqual([
        { key: 'hello', value: 'world', operator: '!=' },
        { key: 'hello', value: 'world2', operator: '!=' },
        ,
      ]);
    });

    it('Should update and add filter to existing set', async () => {
      const { scene, context } = buildTestScene({ existingFilterVariable: true });

      const variable = await getAdHocFilterVariableFor(scene, { uid: 'my-ds-uid' });

      variable.setState({ filters: [{ key: 'existing', value: 'world', operator: '=' }] });

      await context.onAddAdHocFilter!({ key: 'hello', value: 'world', operator: '=' });

      expect(variable.state.filters.length).toBe(2);

      // Can update existing filter value without adding a new filter
      await context.onAddAdHocFilter!({ key: 'hello', value: 'world', operator: '!=' });
      // Verify existing filter value updated
      expect(variable.state.filters[1].operator).toBe('!=');
    });

    it('Should use existing adhoc filter when panel has no panel-level datasource because queries have all the same datasources (v2 behavior)', async () => {
      const { scene, context } = buildTestScene({ existingFilterVariable: true, panelDatasourceUndefined: true });

      const variable = await getAdHocFilterVariableFor(scene, { uid: 'my-ds-uid' });
      variable.setState({ filters: [] });

      await context.onAddAdHocFilter!({ key: 'hello', value: 'world', operator: '=' });

      // Should use the existing adhoc filter variable, not create a new one
      expect(variable.state.filters).toEqual([{ key: 'hello', value: 'world', operator: '=' }]);

      // Verify no new adhoc variables were created
      const variables = sceneGraph.getVariables(scene);
      const adhocVars = variables.state.variables.filter((v) => v.state.type === 'adhoc');
      expect(adhocVars.length).toBe(1);
    });
  });

  describe('getAdHocFilterVariableFor', () => {
    it('does not create duplicate Filters variables when called concurrently', async () => {
      const { scene } = buildTestScene({});

      const [first, second] = await Promise.all([
        getAdHocFilterVariableFor(scene, { uid: 'my-ds-uid' }),
        getAdHocFilterVariableFor(scene, { uid: 'my-ds-uid' }),
      ]);

      const adhocVars = sceneGraph.getVariables(scene).state.variables.filter((v) => v.state.type === 'adhoc');
      expect(adhocVars).toHaveLength(1);
      expect(first).toBe(second);
    });
  });

  describe('getFiltersBasedOnGrouping', () => {
    beforeAll(() => {
      config.featureToggles.groupByVariable = true;
    });

    afterAll(() => {
      config.featureToggles.groupByVariable = false;
    });

    it('should return filters based on grouping', () => {
      const { scene, context } = buildTestScene({ existingFilterVariable: true, existingGroupByVariable: true });

      const groupBy = sceneGraph.getVariables(scene).state.variables.find((f) => f instanceof GroupByVariable);

      groupBy?.changeValueTo(['container', 'cluster']);

      const filters: AdHocFilterItem[] = [
        { key: 'container', value: 'container', operator: '=' },
        { key: 'cluster', value: 'cluster', operator: '=' },
        { key: 'cpu', value: 'cpu', operator: '=' },
        { key: 'id', value: 'id', operator: '=' },
      ];

      const result = context.getFiltersBasedOnGrouping?.(filters);
      expect(result).toEqual([
        { key: 'container', value: 'container', operator: '=' },
        { key: 'cluster', value: 'cluster', operator: '=' },
      ]);
    });

    it('should return empty filters if there is no groupBy selection', () => {
      const { context } = buildTestScene({ existingFilterVariable: true, existingGroupByVariable: true });

      const filters: AdHocFilterItem[] = [
        { key: 'container', value: 'container', operator: '=' },
        { key: 'cluster', value: 'cluster', operator: '=' },
        { key: 'cpu', value: 'cpu', operator: '=' },
        { key: 'id', value: 'id', operator: '=' },
      ];

      const result = context.getFiltersBasedOnGrouping?.(filters);
      expect(result).toEqual([]);
    });

    it('should return empty filters if there is no groupBy variable', () => {
      const { context } = buildTestScene({ existingFilterVariable: true, existingGroupByVariable: false });

      const filters: AdHocFilterItem[] = [
        { key: 'container', value: 'container', operator: '=' },
        { key: 'cluster', value: 'cluster', operator: '=' },
        { key: 'cpu', value: 'cpu', operator: '=' },
        { key: 'id', value: 'id', operator: '=' },
      ];

      const result = context.getFiltersBasedOnGrouping?.(filters);
      expect(result).toEqual([]);
    });

    it('should return empty filters if panel and groupBy ds differs', () => {
      const { scene, context } = buildTestScene({
        existingFilterVariable: true,
        existingGroupByVariable: true,
        groupByDatasourceUid: 'different-ds',
      });

      const groupBy = sceneGraph.getVariables(scene).state.variables.find((f) => f instanceof GroupByVariable);

      groupBy?.changeValueTo(['container', 'cluster']);

      const filters: AdHocFilterItem[] = [
        { key: 'container', value: 'container', operator: '=' },
        { key: 'cluster', value: 'cluster', operator: '=' },
        { key: 'cpu', value: 'cpu', operator: '=' },
        { key: 'id', value: 'id', operator: '=' },
      ];

      const result = context.getFiltersBasedOnGrouping?.(filters);
      expect(result).toEqual([]);
    });
  });

  describe('onAddAdHocFilters', () => {
    it('should add adhoc filters', async () => {
      const { scene, context } = buildTestScene({
        existingFilterVariable: true,
      });

      const variable = await getAdHocFilterVariableFor(scene, { uid: 'my-ds-uid' });

      const filters: AdHocFilterItem[] = [
        { key: 'existing', value: 'val', operator: '=' },
        { key: 'cluster', value: 'cluster', operator: '=' },
      ];

      await context.onAddAdHocFilters?.(filters);
      expect(variable.state.filters).toEqual([
        { key: 'existing', value: 'val', operator: '=' },
        { key: 'cluster', value: 'cluster', operator: '=' },
      ]);
    });

    it('should update and add adhoc filters', async () => {
      const { scene, context } = buildTestScene({
        existingFilterVariable: true,
      });

      const variable = await getAdHocFilterVariableFor(scene, { uid: 'my-ds-uid' });

      variable.setState({ filters: [{ key: 'existing', value: 'val', operator: '=' }] });

      const filters: AdHocFilterItem[] = [
        { key: 'existing', value: 'val', operator: '!=' },
        { key: 'cluster', value: 'cluster', operator: '=' },
        { key: 'cpu', value: 'cpu', operator: '=' },
        { key: 'id', value: 'id', operator: '=' },
      ];

      await context.onAddAdHocFilters?.(filters);
      expect(variable.state.filters).toEqual([
        { key: 'existing', value: 'val', operator: '!=' },
        { key: 'cluster', value: 'cluster', operator: '=' },
        { key: 'cpu', value: 'cpu', operator: '=' },
        { key: 'id', value: 'id', operator: '=' },
      ]);
    });

    it('should not add a filter that already exists with the same key, value and operator', async () => {
      const { scene, context } = buildTestScene({
        existingFilterVariable: true,
      });

      const variable = await getAdHocFilterVariableFor(scene, { uid: 'my-ds-uid' });

      variable.setState({ filters: [{ key: 'existing', value: 'val', operator: '=' }] });

      const filters: AdHocFilterItem[] = [
        { key: 'existing', value: 'val', operator: '=' },
        { key: 'cluster', value: 'cluster', operator: '=' },
      ];

      await context.onAddAdHocFilters?.(filters);
      expect(variable.state.filters).toEqual([
        { key: 'existing', value: 'val', operator: '=' },
        { key: 'cluster', value: 'cluster', operator: '=' },
      ]);
    });

    it('should not update the filters when all new filters are duplicates', async () => {
      const { scene, context } = buildTestScene({
        existingFilterVariable: true,
      });

      const variable = await getAdHocFilterVariableFor(scene, { uid: 'my-ds-uid' });

      variable.setState({ filters: [{ key: 'existing', value: 'val', operator: '=' }] });
      const updateFiltersSpy = jest.spyOn(variable, 'updateFilters');

      await context.onAddAdHocFilters?.([{ key: 'existing', value: 'val', operator: '=' }]);

      expect(updateFiltersSpy).not.toHaveBeenCalled();
      expect(variable.state.filters).toEqual([{ key: 'existing', value: 'val', operator: '=' }]);
    });

    it('should not do anything if filters empty', async () => {
      const { scene, context } = buildTestScene({
        existingFilterVariable: true,
      });

      const variable = await getAdHocFilterVariableFor(scene, { uid: 'my-ds-uid' });

      const filters: AdHocFilterItem[] = [];

      await context.onAddAdHocFilters?.(filters);
      expect(variable.state.filters).toEqual([]);
    });
  });

  describe('ad-hoc transformations', () => {
    /** Puts `level` in front of `time`, so a run is visible in the output field order. */
    const reorder: DataTransformerConfig = {
      id: 'organize',
      options: { indexByName: { level: 0, time: 1, msg: 2 }, excludeByName: {}, renameByName: {} },
    };

    beforeAll(() => {
      standardTransformersRegistry.setInit(getStandardTransformers);
    });

    function stubAdHocFlag(enabled: boolean) {
      getBooleanValueFn.mockImplementation((key: string, defaultValue: boolean) =>
        key === FlagKeys.GrafanaAdHocTransformations ? enabled : defaultValue
      );
    }

    function buildScene(options: SceneOptions = {}) {
      const scene = buildTestScene({ dashboardCanEdit: true, ...options });

      return { ...scene, transformer: getDataTransformerFor(scene.vizPanel)! };
    }

    /** Stands a data node in for the query runner, so the pipeline has frames without a datasource. */
    function feedFrames(transformer: SceneDataTransformer) {
      transformer.setState({
        $data: new SceneDataNode({
          data: {
            state: LoadingState.Done,
            series: [
              toDataFrame({
                fields: [
                  { name: 'time', values: [1] },
                  { name: 'level', values: ['info'] },
                  { name: 'msg', values: ['hello'] },
                ],
              }),
            ],
            timeRange: getDefaultTimeRange(),
          },
        }),
      });
    }

    /** Field names of the first output frame. */
    const fieldNames = (transformer: SceneDataTransformer) =>
      transformer.state.data?.series[0]?.fields.map((f) => f.name);

    it.each([
      { desc: 'the feature flag is off', enabled: false, dashboardCanEdit: true },
      { desc: 'the dashboard cannot be edited', enabled: true, dashboardCanEdit: false },
    ])('leaves both members undefined when $desc', ({ enabled, dashboardCanEdit }) => {
      stubAdHocFlag(enabled);

      const { context } = buildScene({ dashboardCanEdit });

      expect(context.transformations).toBeUndefined();
      expect(context.onTransformationsChange).toBeUndefined();
    });

    it("reads the panel's saved transformations", () => {
      stubAdHocFlag(true);

      const { context } = buildScene({ panelTransformations: [reorder] });

      expect(context.transformations).toEqual([reorder]);
    });

    it('returns undefined once the panel provider is no longer a transformer', () => {
      stubAdHocFlag(true);
      const { context, vizPanel } = buildScene();

      expect(context.transformations).toEqual([]);

      // The context is built once and cached on the panel while `$data` can be replaced under it, as
      // picking a datasource for a new panel does
      vizPanel.setState({ $data: new SceneQueryRunner({ queries: [{ refId: 'A' }], runQueriesMode: 'manual' }) });

      expect(context.transformations).toBeUndefined();
    });

    it('applies a written transformation to the frames the panel renders', async () => {
      stubAdHocFlag(true);
      const { context, transformer } = buildScene();
      feedFrames(transformer);
      activateFullSceneTree(transformer);

      await waitFor(() => {
        expect(fieldNames(transformer)).toEqual(['time', 'level', 'msg']);
      });

      context.onTransformationsChange!([reorder]);

      await waitFor(() => {
        expect(fieldNames(transformer)).toEqual(['level', 'time', 'msg']);
      });
      expect(context.transformations).toEqual([reorder]);
    });

    it("keeps another origin's transformation out of the read and running after a write", async () => {
      stubAdHocFlag(true);
      const { context, transformer } = buildScene();
      feedFrames(transformer);
      // A provider registering concrete entries, which is what would end up sharing state.transformations
      transformer.setSystemTransformations({
        origin: 'test',
        append: [{ id: 'organize', options: { excludeByName: { msg: true }, renameByName: {} } }],
      });
      activateFullSceneTree(transformer);

      await waitFor(() => {
        expect(fieldNames(transformer)).toEqual(['time', 'level']);
      });
      expect(context.transformations).toEqual([]);

      context.onTransformationsChange!([reorder]);

      // Reordered by the write, and `msg` is still dropped by the other origin's entry
      await waitFor(() => {
        expect(fieldNames(transformer)).toEqual(['level', 'time']);
      });
      expect(context.transformations).toEqual([reorder]);
      expect(transformer.state.transformations).toHaveLength(2);
    });

    it('returns the same array across reads and a new one after a write', () => {
      stubAdHocFlag(true);
      const { context } = buildScene({ panelTransformations: [reorder] });

      // A panel using this as an effect dep re-runs the effect on every render if the identity churns
      const first = context.transformations;

      expect(context.transformations).toBe(first);

      context.onTransformationsChange!([]);

      expect(context.transformations).toEqual([]);
      expect(context.transformations).not.toBe(first);
    });

    it('makes the dashboard dirty and lands the config in the save model', () => {
      stubAdHocFlag(true);
      const { context, scene, vizPanel } = buildScene();
      const events: SceneObjectStateChangedEvent[] = [];
      vizPanel.subscribeToEvent(SceneObjectStateChangedEvent, (event) => events.push(event));

      context.onTransformationsChange!([reorder]);

      const writes = events.filter((event) =>
        Object.prototype.hasOwnProperty.call(event.payload.partialUpdate ?? {}, 'transformations')
      );

      expect(writes).toHaveLength(1);
      expect(DashboardSceneChangeTracker.isUpdatingPersistedState(writes[0])).toBe(true);
      expect(transformSceneToSaveModel(scene).panels?.[0]).toMatchObject({ transformations: [reorder] });
    });

    it('writes nothing when the list matches the one already configured', () => {
      stubAdHocFlag(true);
      const { context, vizPanel } = buildScene({ panelTransformations: [reorder] });
      const events: SceneObjectStateChangedEvent[] = [];
      vizPanel.subscribeToEvent(SceneObjectStateChangedEvent, (event) => events.push(event));

      context.onTransformationsChange!([{ ...reorder, options: { ...reorder.options } }]);

      expect(events).toEqual([]);
    });
  });
});

interface SceneOptions {
  builtInAnnotationsEnabled?: boolean;
  dashboardCanEdit?: boolean;
  canAdd?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  existingFilterVariable?: boolean;
  existingGroupByVariable?: boolean;
  groupByDatasourceUid?: string;
  panelDatasourceUndefined?: boolean;
  panelTransformations?: DataTransformerConfig[];
}

function buildTestScene(options: SceneOptions) {
  const varList: VariableModel[] = [];

  if (options.existingFilterVariable) {
    varList.push({
      type: 'adhoc',
      name: 'Filters',
      datasource: { uid: 'my-ds-uid' },
    } as AdHocVariableModel);
  }

  if (options.existingGroupByVariable) {
    varList.push({
      type: 'groupby',
      name: 'Group By',
      datasource: { uid: options.groupByDatasourceUid ?? 'my-ds-uid', type: 'prometheus' },
    } as GroupByVariableModel);
  }

  const scene = transformSaveModelToScene({
    dashboard: {
      title: 'hello',
      uid: 'dash-1',
      schemaVersion: 38,
      annotations: {
        list: [
          {
            builtIn: 1,
            datasource: {
              type: 'grafana',
              uid: '-- Grafana --',
            },
            enable: options.builtInAnnotationsEnabled ?? false,
            hide: true,
            iconColor: 'rgba(0, 211, 255, 1)',
            name: 'Annotations & Alerts',
            target: { refId: 'A' },
            type: 'dashboard',
          },
        ],
      },
      panels: [
        {
          type: 'timeseries',
          id: 4,
          datasource: { uid: 'my-ds-uid', type: 'prometheus' },
          targets: [],
          transformations: options.panelTransformations,
        },
      ],
      templating: {
        list: varList,
      },
    },
    meta: {
      canEdit: options.dashboardCanEdit,
      annotationsPermissions: {
        dashboard: {
          canAdd: options.canAdd ?? false,
          canEdit: options.canEdit ?? false,
          canDelete: options.canDelete ?? false,
        },
      },
    },
  });

  const vizPanel = findVizPanelByKey(scene, 'panel-4')!;

  // Simulate v2 dashboard behavior where non-mixed panels don't have panel-level datasource
  // but the queries have their own datasources
  if (options.panelDatasourceUndefined) {
    const queryRunner = getQueryRunnerFor(vizPanel);
    if (queryRunner instanceof SceneQueryRunner) {
      queryRunner.setState({
        datasource: undefined,
        queries: [{ refId: 'A', datasource: { uid: 'my-ds-uid', type: 'prometheus' } }],
      });
    }
  }

  const context: PanelContext = {
    eventBus: new EventBusSrv(),
    eventsScope: 'global',
  };

  setDashboardPanelContext(vizPanel, context);

  return { scene, vizPanel, context };
}
