import { DashboardScene } from '../scene/DashboardScene';

import { savedDashboardViewsApi, type SavedDashboardView } from './api';
import { loadSavedViews } from './loadSavedViews';

jest.mock('./api', () => ({
  savedDashboardViewsApi: {
    listForDashboard: jest.fn(),
  },
}));

const listForDashboardMock = savedDashboardViewsApi.listForDashboard as jest.Mock;

describe('loadSavedViews', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('does nothing when the dashboard has no uid', async () => {
    const scene = new DashboardScene({ title: 'unsaved' });

    await expect(loadSavedViews(scene)).resolves.toBe(true);

    expect(listForDashboardMock).not.toHaveBeenCalled();
    expect(scene.state.savedViews).toBeUndefined();
  });

  it('fetches views for the dashboard, attaches them to state, and resolves true', async () => {
    const view: SavedDashboardView = {
      apiVersion: 'dashboardviews.grafana.app/v0alpha1',
      kind: 'SavedDashboardView',
      metadata: { name: 'view-1', resourceVersion: '1', creationTimestamp: '' },
      spec: { dashboardUID: 'dash-1', name: 'My view', timeRange: { from: 'now-6h', to: 'now' }, variables: [] },
    };
    listForDashboardMock.mockResolvedValue([view]);
    const scene = new DashboardScene({ title: 'hello', uid: 'dash-1' });

    await expect(loadSavedViews(scene)).resolves.toBe(true);

    expect(listForDashboardMock).toHaveBeenCalledWith('dash-1');
    expect(scene.state.savedViews).toEqual([view]);
  });

  it('logs and swallows a fetch failure, resolving false so the caller can tell it apart from success', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    listForDashboardMock.mockRejectedValue(new Error('boom'));
    const scene = new DashboardScene({ title: 'hello', uid: 'dash-1' });

    await expect(loadSavedViews(scene)).resolves.toBe(false);

    expect(scene.state.savedViews).toBeUndefined();
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
