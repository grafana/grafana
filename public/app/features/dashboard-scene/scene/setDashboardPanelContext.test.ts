import { PanelContext } from '@grafana/ui';

import { transformSaveModelToScene } from '../serialization/transformSaveModelToScene';
import { findVizPanelByKey } from '../utils/utils';

import { setDashboardPanelContext } from './setDashboardPanelContext';

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
});

interface SceneOptions {
  builtInAnnotationsEnabled?: boolean;
  dashboardCanEdit?: boolean;
  canAdd?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  orgCanEdit?: boolean;
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
        },
      ],
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
          canDelete: false,
        },
      },
    },
  });

  const vizPanel = findVizPanelByKey(scene, 'panel-4')!;
  const context: PanelContext = {} as PanelContext;

  setDashboardPanelContext(vizPanel, context);

  return { scene, vizPanel, context };
}
