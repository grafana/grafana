import { act, renderHook } from '@testing-library/react';
import { getWrapper } from 'test/test-utils';

import { transformSaveModelToScene } from '../serialization/transformSaveModelToScene';
import { transformSceneToSaveModel } from '../serialization/transformSceneToSaveModel';

import { useSaveDashboard } from './useSaveDashboard';

const saveDashboardMutationMock = jest
  .fn()
  .mockResolvedValue({ data: { status: 'success', version: 2, url: '/d/my-uid' } });

jest.mock('app/features/browse-dashboards/api/browseDashboardsAPI', () => ({
  ...jest.requireActual('app/features/browse-dashboards/api/browseDashboardsAPI'),
  useSaveDashboardMutation: () => [saveDashboardMutationMock],
}));

let cleanUpPreviousScene = () => {};

function buildScene() {
  cleanUpPreviousScene();
  const dashboard = transformSaveModelToScene({
    dashboard: { title: 'hello', uid: 'my-uid', schemaVersion: 30, panels: [], version: 1 },
    meta: {},
  });
  dashboard.setState({ $data: undefined });
  dashboard.setInitialSaveModel(transformSceneToSaveModel(dashboard));
  cleanUpPreviousScene = dashboard.activate();
  dashboard.onEnterEditMode();
  return dashboard;
}

beforeEach(() => {
  saveDashboardMutationMock.mockClear();
});

afterEach(() => {
  cleanUpPreviousScene();
  cleanUpPreviousScene = () => {};
});

describe('useSaveDashboard', () => {
  it('refuses to save while a plan preview is active, without reaching the backend', async () => {
    const scene = buildScene();
    // This is the chokepoint every save caller funnels through (SaveDashboardForm,
    // SaveDashboardAsForm, and JsonModelEditView — the last one calls it directly, without
    // going through DashboardScene.openSaveDrawer's own planning check).
    scene.setState({
      planning: { planId: 'plan-1', planTitle: 'Health', panelCount: 1, onBuild: () => {}, onDismiss: () => {} },
    });

    const { result } = renderHook(() => useSaveDashboard(), { wrapper: getWrapper({}) });

    // Mirrors the exact shape JsonModelEditView.onSave passes: rawDashboardJSON + overwrite + k8s,
    // no drawer involved. dashboardSettingsRedesign being off is what makes that Save button
    // reachable in the real UI; this test exercises the hook directly regardless of that flag,
    // since the hook itself has no UI to hide.
    await act(async () => {
      await result.current.onSaveDashboard(scene, {
        folderUid: undefined,
        overwrite: false,
        rawDashboardJSON: scene.getSaveModel(),
        k8s: scene.state.meta.k8s,
      });
    });

    expect(saveDashboardMutationMock).not.toHaveBeenCalled();
    expect(result.current.state.error).toBeInstanceOf(Error);
    expect(result.current.state.error?.message).toMatch(/plan preview/i);
  });

  it('still saves normally when no plan preview is active', async () => {
    const scene = buildScene();

    const { result } = renderHook(() => useSaveDashboard(), { wrapper: getWrapper({}) });

    await act(async () => {
      await result.current.onSaveDashboard(scene, {
        folderUid: undefined,
        overwrite: false,
        rawDashboardJSON: scene.getSaveModel(),
        k8s: scene.state.meta.k8s,
      });
    });

    expect(saveDashboardMutationMock).toHaveBeenCalledTimes(1);
    expect(result.current.state.error).toBeUndefined();
  });
});
