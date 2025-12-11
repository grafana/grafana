import { AdHocVariableModel, EventBusSrv, GroupByVariableModel, VariableModel } from '@grafana/data';
import { BackendSrv, config, setBackendSrv } from '@grafana/runtime';
import { GroupByVariable, sceneGraph } from '@grafana/scenes';
import { AdHocFilterItem, PanelContext } from '@grafana/ui';

import { transformSaveModelToScene } from '../serialization/transformSaveModelToScene';
import { findVizPanelByKey } from '../utils/utils';

import { getAdHocFilterVariableFor, setDashboardPanelContext } from './setDashboardPanelContext';

const postFn = jest.fn();
const putFn = jest.fn();
const deleteFn = jest.fn();

setBackendSrv({
  post: postFn,
  put: putFn,
  delete: deleteFn,
} as unknown as BackendSrv);

describe('setDashboardPanelContext', () => {
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
      const { context } = buildTestScene({ dashboardCanEdit: true, orgCanEdit: true });
      expect(context.canEditAnnotations!()).toBe(true);
    });

    it('Can not edit global event when has no org permission', () => {
      const { context } = buildTestScene({ dashboardCanEdit: true, orgCanEdit: false });
      expect(context.canEditAnnotations!()).toBe(false);
    });

    it('Can edit dashboard event when has dashboard permission', () => {
      const { context } = buildTestScene({ dashboardCanEdit: true, canEdit: true });
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
    it('should create annotation', () => {
      const { context } = buildTestScene({ dashboardCanEdit: true, canAdd: true });

      context.onAnnotationCreate!({ from: 100, to: 200, description: 'save it', tags: [] });

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
  });

  describe('onAnnotationUpdate', () => {
    it('should update annotation', () => {
      const { context } = buildTestScene({ dashboardCanEdit: true, canAdd: true });

      context.onAnnotationUpdate!({ from: 100, to: 200, id: 'event-id-123', description: 'updated', tags: [] });

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
  });

  describe('onAnnotationDelete', () => {
    it('should update annotation', () => {
      const { context } = buildTestScene({ dashboardCanEdit: true, canAdd: true });

      context.onAnnotationDelete!('I-do-not-want-you');

      expect(deleteFn).toHaveBeenCalledWith('/api/annotations/I-do-not-want-you');
    });
  });

  describe('onAddAdHocFilter', () => {
    it('Should add new filter set', () => {
      const { scene, context } = buildTestScene({});

      context.onAddAdHocFilter!({ key: 'hello', value: 'world', operator: '!=' });
      context.onAddAdHocFilter!({ key: 'hello', value: 'world2', operator: '!=' });

      const variable = getAdHocFilterVariableFor(scene, { uid: 'my-ds-uid' });

      expect(variable.state.filters).toEqual([
        { key: 'hello', value: 'world', operator: '!=' },
        { key: 'hello', value: 'world2', operator: '!=' },
        ,
      ]);
    });

    it('Should update and add filter to existing set', () => {
      const { scene, context } = buildTestScene({ existingFilterVariable: true });

      const variable = getAdHocFilterVariableFor(scene, { uid: 'my-ds-uid' });

      variable.setState({ filters: [{ key: 'existing', value: 'world', operator: '=' }] });

      context.onAddAdHocFilter!({ key: 'hello', value: 'world', operator: '=' });

      expect(variable.state.filters.length).toBe(2);

      // Can update existing filter value without adding a new filter
      context.onAddAdHocFilter!({ key: 'hello', value: 'world', operator: '!=' });
      // Verify existing filter value updated
      expect(variable.state.filters[1].operator).toBe('!=');
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
    it('should add adhoc filters', () => {
      const { scene, context } = buildTestScene({
        existingFilterVariable: true,
      });

      const variable = getAdHocFilterVariableFor(scene, { uid: 'my-ds-uid' });

      const filters: AdHocFilterItem[] = [
        { key: 'existing', value: 'val', operator: '=' },
        { key: 'cluster', value: 'cluster', operator: '=' },
      ];

      context.onAddAdHocFilters?.(filters);
      expect(variable.state.filters).toEqual([
        { key: 'existing', value: 'val', operator: '=' },
        { key: 'cluster', value: 'cluster', operator: '=' },
      ]);
    });

    it('should update and add adhoc filters', () => {
      const { scene, context } = buildTestScene({
        existingFilterVariable: true,
      });

      const variable = getAdHocFilterVariableFor(scene, { uid: 'my-ds-uid' });

      variable.setState({ filters: [{ key: 'existing', value: 'val', operator: '=' }] });

      const filters: AdHocFilterItem[] = [
        { key: 'existing', value: 'val', operator: '!=' },
        { key: 'cluster', value: 'cluster', operator: '=' },
        { key: 'cpu', value: 'cpu', operator: '=' },
        { key: 'id', value: 'id', operator: '=' },
      ];

      context.onAddAdHocFilters?.(filters);
      expect(variable.state.filters).toEqual([
        { key: 'existing', value: 'val', operator: '!=' },
        { key: 'cluster', value: 'cluster', operator: '=' },
        { key: 'cpu', value: 'cpu', operator: '=' },
        { key: 'id', value: 'id', operator: '=' },
      ]);
    });

    it('should not do anything if filters empty', () => {
      const { scene, context } = buildTestScene({
        existingFilterVariable: true,
      });

      const variable = getAdHocFilterVariableFor(scene, { uid: 'my-ds-uid' });

      const filters: AdHocFilterItem[] = [];

      context.onAddAdHocFilters?.(filters);
      expect(variable.state.filters).toEqual([]);
    });
  });
});

interface SceneOptions {
  builtInAnnotationsEnabled?: boolean;
  dashboardCanEdit?: boolean;
  canAdd?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  orgCanEdit?: boolean;
  existingFilterVariable?: boolean;
  existingGroupByVariable?: boolean;
  groupByDatasourceUid?: string;
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
        organization: {
          canAdd: false,
          canEdit: options.orgCanEdit ?? false,
          canDelete: options.canDelete ?? false,
        },
      },
    },
  });

  const vizPanel = findVizPanelByKey(scene, 'panel-4')!;
  const context: PanelContext = {
    eventBus: new EventBusSrv(),
    eventsScope: 'global',
  };

  setDashboardPanelContext(vizPanel, context);

  return { scene, vizPanel, context };
}
