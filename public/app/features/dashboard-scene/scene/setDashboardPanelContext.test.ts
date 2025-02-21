import { EventBusSrv } from '@grafana/data';
import { BackendSrv, setBackendSrv } from '@grafana/runtime';
import { PanelContext } from '@grafana/ui';

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
});

interface SceneOptions {
  builtInAnnotationsEnabled?: boolean;
  dashboardCanEdit?: boolean;
  canAdd?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  orgCanEdit?: boolean;
  existingFilterVariable?: boolean;
}

function buildTestScene(options: SceneOptions) {
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
        list: options.existingFilterVariable
          ? [
              {
                type: 'adhoc',
                name: 'Filters',
                datasource: { uid: 'my-ds-uid' },
              },
            ]
          : [],
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
