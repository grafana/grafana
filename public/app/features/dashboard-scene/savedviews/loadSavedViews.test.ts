import { type UrlQueryMap } from '@grafana/data';
import { locationService } from '@grafana/runtime';

import { DashboardScene } from '../scene/DashboardScene';

import { savedDashboardViewsApi, type SavedDashboardView } from './api';
import { getDefaultSavedView, setDefaultSavedView } from './defaultView';
import { applyDefaultSavedViewToUrl, loadSavedViews } from './loadSavedViews';

jest.mock('./api', () => ({
  savedDashboardViewsApi: {
    listForDashboard: jest.fn(),
    get: jest.fn(),
  },
}));

jest.mock('./defaultView', () => ({
  getDefaultSavedView: jest.fn(),
  setDefaultSavedView: jest.fn(),
}));

const listForDashboardMock = savedDashboardViewsApi.listForDashboard as jest.Mock;
const getMock = savedDashboardViewsApi.get as jest.Mock;
const mockGetDefaultSavedView = jest.mocked(getDefaultSavedView);
const mockSetDefaultSavedView = jest.mocked(setDefaultSavedView);

function buildView(name: string): SavedDashboardView {
  return {
    apiVersion: 'dashboardviews.grafana.app/v0alpha1',
    kind: 'SavedDashboardView',
    metadata: { name, resourceVersion: '1', creationTimestamp: '' },
    spec: { dashboardUID: 'dash-1', name, timeRange: { from: 'now-1h', to: 'now' }, variables: [] },
  };
}

describe('loadSavedViews', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('does nothing when the dashboard has no uid', async () => {
    const scene = new DashboardScene({ title: 'unsaved' });

    await loadSavedViews(scene);

    expect(listForDashboardMock).not.toHaveBeenCalled();
    expect(scene.state.savedViews).toBeUndefined();
  });

  it('fetches views for the dashboard and attaches them to state', async () => {
    const view: SavedDashboardView = {
      apiVersion: 'dashboardviews.grafana.app/v0alpha1',
      kind: 'SavedDashboardView',
      metadata: { name: 'view-1', resourceVersion: '1', creationTimestamp: '' },
      spec: { dashboardUID: 'dash-1', name: 'My view', timeRange: { from: 'now-6h', to: 'now' }, variables: [] },
    };
    listForDashboardMock.mockResolvedValue([view]);
    const scene = new DashboardScene({ title: 'hello', uid: 'dash-1' });

    await loadSavedViews(scene);

    expect(listForDashboardMock).toHaveBeenCalledWith('dash-1');
    expect(scene.state.savedViews).toEqual([view]);
  });

  it('logs and swallows a fetch failure rather than throwing', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    listForDashboardMock.mockRejectedValue(new Error('boom'));
    const scene = new DashboardScene({ title: 'hello', uid: 'dash-1' });

    await expect(loadSavedViews(scene)).resolves.toBeUndefined();

    expect(scene.state.savedViews).toBeUndefined();
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});

describe('applyDefaultSavedViewToUrl', () => {
  let currentSearch: UrlQueryMap;
  let getSearchObjectSpy: jest.SpyInstance;
  let partialSpy: jest.SpyInstance;

  beforeEach(() => {
    currentSearch = {};
    getSearchObjectSpy = jest.spyOn(locationService, 'getSearchObject').mockImplementation(() => currentSearch);
    partialSpy = jest.spyOn(locationService, 'partial').mockImplementation((values) => {
      currentSearch = { ...currentSearch, ...values };
    });
    mockSetDefaultSavedView.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
    getSearchObjectSpy.mockRestore();
    partialSpy.mockRestore();
  });

  it('writes ?viewFilter= for a stored default when the url has none', async () => {
    mockGetDefaultSavedView.mockResolvedValue('view-1');
    getMock.mockResolvedValue(buildView('view-1'));
    const scene = new DashboardScene({ title: 'hello', uid: 'dash-1' });

    await applyDefaultSavedViewToUrl(scene);

    expect(partialSpy).toHaveBeenCalledWith({ viewFilter: 'view-1' });
  });

  it('does nothing when the url already has an explicit viewFilter', async () => {
    currentSearch = { viewFilter: 'view-2' };
    const scene = new DashboardScene({ title: 'hello', uid: 'dash-1' });

    await applyDefaultSavedViewToUrl(scene);

    expect(mockGetDefaultSavedView).not.toHaveBeenCalled();
    expect(partialSpy).not.toHaveBeenCalled();
  });

  it('does nothing when there is no stored default', async () => {
    mockGetDefaultSavedView.mockResolvedValue(undefined);
    const scene = new DashboardScene({ title: 'hello', uid: 'dash-1' });

    await applyDefaultSavedViewToUrl(scene);

    expect(partialSpy).not.toHaveBeenCalled();
  });

  it('does nothing when the dashboard has no uid', async () => {
    const scene = new DashboardScene({ title: 'unsaved' });

    await applyDefaultSavedViewToUrl(scene);

    expect(mockGetDefaultSavedView).not.toHaveBeenCalled();
  });

  it('self-heals a stored default pointing at a view that no longer resolves, and never writes it to the url', async () => {
    mockGetDefaultSavedView.mockResolvedValue('view-deleted');
    getMock.mockRejectedValue(new Error('not found'));
    const scene = new DashboardScene({ title: 'hello', uid: 'dash-1' });

    await applyDefaultSavedViewToUrl(scene);

    expect(mockSetDefaultSavedView).toHaveBeenCalledWith('dash-1', undefined);
    expect(partialSpy).not.toHaveBeenCalled();
  });
});
