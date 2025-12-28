import { defaultSpec as defaultDashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2';

import { getCurrentDashboardKindV2 } from './currentDashboardKindV2';
import { applyCurrentDashboardKindV2, applyCurrentDashboardSpecV2 } from './currentDashboardSpecApplyV2';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  config: {
    featureToggles: {
      kubernetesDashboards: true,
      kubernetesDashboardsV2: true,
      dashboardNewLayouts: false,
    },
  },
}));

jest.mock('../pages/DashboardScenePageStateManager', () => ({
  getDashboardScenePageStateManager: jest.fn(),
}));

jest.mock('../serialization/transformSaveModelSchemaV2ToScene', () => ({
  transformSaveModelSchemaV2ToScene: jest.fn(),
}));

describe('current dashboard spec apply API', () => {
  const { getDashboardScenePageStateManager } = jest.requireMock('../pages/DashboardScenePageStateManager');
  const { transformSaveModelSchemaV2ToScene } = jest.requireMock('../serialization/transformSaveModelSchemaV2ToScene');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('applyCurrentDashboardSpecV2 swaps in a new scene immediately and marks it dirty', () => {
    const currentSpec = defaultDashboardV2Spec();
    const nextSpec = { ...defaultDashboardV2Spec(), title: 'new title' };

    const currentScene = {
      state: {
        uid: 'dash-uid',
        meta: {
          url: '/d/dash-uid/slug',
          slug: 'slug',
          canSave: true,
          canEdit: true,
          canDelete: true,
          canShare: true,
          canStar: true,
          canAdmin: true,
          publicDashboardEnabled: false,
          k8s: {
            name: 'dash-uid',
            resourceVersion: '1',
            creationTimestamp: 'now',
            annotations: {},
            labels: {},
          },
        },
        isEditing: true,
      },
      getSaveModel: () => currentSpec,
      getInitialSaveModel: () => currentSpec,
    };

    const nextScene = {
      onEnterEditMode: jest.fn(),
      setState: jest.fn(),
      setInitialSaveModel: jest.fn(),
    };

    transformSaveModelSchemaV2ToScene.mockReturnValue(nextScene);

    const mgr = {
      state: { dashboard: currentScene },
      setSceneCache: jest.fn(),
      setState: jest.fn(),
    };

    getDashboardScenePageStateManager.mockReturnValue(mgr);

    applyCurrentDashboardSpecV2(nextSpec);

    expect(transformSaveModelSchemaV2ToScene).toHaveBeenCalledTimes(1);
    expect(nextScene.setInitialSaveModel).toHaveBeenCalledWith(currentSpec, currentScene.state.meta.k8s, 'dashboard.grafana.app/v2beta1');
    expect(nextScene.onEnterEditMode).toHaveBeenCalled();
    expect(nextScene.setState).toHaveBeenCalledWith({ isDirty: true });
    expect(mgr.setSceneCache).toHaveBeenCalledWith('dash-uid', nextScene);
    expect(mgr.setState).toHaveBeenCalledWith({ dashboard: nextScene });
  });

  it('applyCurrentDashboardSpecV2 does not mark dirty when the applied spec matches the saved baseline', () => {
    const currentSpec = defaultDashboardV2Spec();
    const nextSpec = { ...currentSpec };

    const currentScene = {
      state: {
        uid: 'dash-uid',
        meta: {
          url: '/d/dash-uid/slug',
          slug: 'slug',
          canSave: true,
          canEdit: true,
          canDelete: true,
          canShare: true,
          canStar: true,
          canAdmin: true,
          publicDashboardEnabled: false,
          k8s: {
            name: 'dash-uid',
            resourceVersion: '1',
            creationTimestamp: 'now',
            annotations: {},
            labels: {},
          },
        },
        isEditing: true,
      },
      getSaveModel: () => currentSpec,
      getInitialSaveModel: () => currentSpec,
    };

    const nextScene = {
      onEnterEditMode: jest.fn(),
      setState: jest.fn(),
      setInitialSaveModel: jest.fn(),
    };

    transformSaveModelSchemaV2ToScene.mockReturnValue(nextScene);

    const mgr = {
      state: { dashboard: currentScene },
      setSceneCache: jest.fn(),
      setState: jest.fn(),
    };

    getDashboardScenePageStateManager.mockReturnValue(mgr);

    applyCurrentDashboardSpecV2(nextSpec);

    expect(nextScene.setState).toHaveBeenCalledWith({ isDirty: false });
  });

  it('applyCurrentDashboardKindV2 rejects metadata changes and applies only spec when unchanged', () => {
    const spec = defaultDashboardV2Spec();

    const currentScene = {
      state: {
        uid: 'dash-uid',
        meta: {
          url: '/d/dash-uid/slug',
          slug: 'slug',
          canSave: true,
          canEdit: true,
          canDelete: true,
          canShare: true,
          canStar: true,
          canAdmin: true,
          publicDashboardEnabled: false,
          k8s: {
            name: 'dash-uid',
            resourceVersion: '1',
            creationTimestamp: 'now',
            annotations: {},
            labels: {},
          },
        },
        isEditing: true,
      },
      getSaveModel: () => spec,
      getSaveResource: () => ({
        apiVersion: 'dashboard.grafana.app/v2beta1',
        kind: 'Dashboard',
        metadata: { name: 'dash-uid' },
        spec,
      }),
    };

    const nextScene = { onEnterEditMode: jest.fn(), setState: jest.fn() };
    transformSaveModelSchemaV2ToScene.mockReturnValue(nextScene);

    const mgr = { state: { dashboard: currentScene }, setSceneCache: jest.fn(), setState: jest.fn() };
    getDashboardScenePageStateManager.mockReturnValue(mgr);

    const current = getCurrentDashboardKindV2();
    expect(() =>
      applyCurrentDashboardKindV2({
        ...current,
        metadata: {
          ...current.metadata,
          annotations: { ...(current.metadata.annotations ?? {}), 'grafana.app/message': 'changed' },
        },
      })
    ).toThrow('Changing metadata is not allowed');
  });
});


