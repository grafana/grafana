import { type Location } from 'history';

import { type UrlQueryMap } from '@grafana/data';
import { locationService } from '@grafana/runtime';

import { DashboardScene } from '../scene/DashboardScene';

import { savedDashboardViewsApi, type SavedDashboardView } from './api';
import { getDefaultSavedView, setDefaultSavedView } from './defaultView';
import { applyDefaultSavedViewToUrl, loadSavedViews } from './loadSavedViews';

jest.mock('./api', () => ({
  savedDashboardViewsApi: {
    listForDashboard: jest.fn(),
  },
}));

jest.mock('./defaultView', () => ({
  getDefaultSavedView: jest.fn(),
  setDefaultSavedView: jest.fn(),
}));

const listForDashboardMock = jest.mocked(savedDashboardViewsApi.listForDashboard);
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

describe('applyDefaultSavedViewToUrl', () => {
  let currentSearch: UrlQueryMap;
  let currentPathname: string;
  let getSearchObjectSpy: jest.SpyInstance;
  let getLocationSpy: jest.SpyInstance;
  let partialSpy: jest.SpyInstance;

  beforeEach(() => {
    currentSearch = {};
    currentPathname = '/d/dash-1/some-dashboard';
    getSearchObjectSpy = jest.spyOn(locationService, 'getSearchObject').mockImplementation(() => currentSearch);
    getLocationSpy = jest
      .spyOn(locationService, 'getLocation')
      .mockImplementation(() => ({ pathname: currentPathname }) as Location);
    partialSpy = jest.spyOn(locationService, 'partial').mockImplementation((values) => {
      currentSearch = { ...currentSearch, ...values };
    });
    mockSetDefaultSavedView.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
    getSearchObjectSpy.mockRestore();
    getLocationSpy.mockRestore();
    partialSpy.mockRestore();
  });

  it('writes ?viewFilter= for a stored default with a single list request, replacing rather than pushing', async () => {
    mockGetDefaultSavedView.mockResolvedValue('view-1');
    listForDashboardMock.mockResolvedValue([buildView('view-1')]);
    const scene = new DashboardScene({ title: 'hello', uid: 'dash-1' });

    await applyDefaultSavedViewToUrl(scene);

    expect(listForDashboardMock).toHaveBeenCalledTimes(1);
    expect(listForDashboardMock).toHaveBeenCalledWith('dash-1');
    expect(scene.state.savedViews).toEqual([buildView('view-1')]);
    // Replace, not push: this is initialization, not a navigation.
    expect(partialSpy).toHaveBeenCalledWith({ viewFilter: 'view-1' }, true);
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

  it('clears a stored default whose view is no longer listed for this dashboard, and never writes it to the url', async () => {
    mockGetDefaultSavedView.mockResolvedValue('view-deleted');
    listForDashboardMock.mockResolvedValue([buildView('view-1')]);
    const scene = new DashboardScene({ title: 'hello', uid: 'dash-1' });

    await applyDefaultSavedViewToUrl(scene);

    expect(mockSetDefaultSavedView).toHaveBeenCalledWith('dash-1', undefined);
    expect(partialSpy).not.toHaveBeenCalled();
  });

  it.each([
    ['a 5xx', { status: 503, data: {}, config: {} }],
    ['a network error', new TypeError('Failed to fetch')],
  ])('keeps the stored default when listing fails with %s', async (_, error) => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockGetDefaultSavedView.mockResolvedValue('view-1');
    listForDashboardMock.mockRejectedValue(error);
    const scene = new DashboardScene({ title: 'hello', uid: 'dash-1' });

    await applyDefaultSavedViewToUrl(scene);

    expect(mockSetDefaultSavedView).not.toHaveBeenCalled();
    expect(partialSpy).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('does not write viewFilter if the viewer navigated to a different dashboard while the default lookup was in flight', async () => {
    mockGetDefaultSavedView.mockImplementation(async () => {
      currentPathname = '/d/dash-2/a-different-dashboard'; // navigated away mid-await
      return 'view-1';
    });
    const scene = new DashboardScene({ title: 'hello', uid: 'dash-1' });

    await applyDefaultSavedViewToUrl(scene);

    expect(listForDashboardMock).not.toHaveBeenCalled();
    expect(partialSpy).not.toHaveBeenCalled();
  });

  it('does not treat a dashboard whose uid merely starts with this one as the same dashboard', async () => {
    mockGetDefaultSavedView.mockImplementation(async () => {
      currentPathname = '/d/dash-1-prod/another-dashboard'; // navigated away mid-await
      return 'view-1';
    });
    const scene = new DashboardScene({ title: 'hello', uid: 'dash-1' });

    await applyDefaultSavedViewToUrl(scene);

    expect(listForDashboardMock).not.toHaveBeenCalled();
    expect(partialSpy).not.toHaveBeenCalled();
  });

  it('does not write viewFilter if the viewer navigated away while the list was in flight', async () => {
    mockGetDefaultSavedView.mockResolvedValue('view-1');
    listForDashboardMock.mockImplementation(async () => {
      currentPathname = '/d/dash-2/a-different-dashboard'; // navigated away mid-await
      return [buildView('view-1')];
    });
    const scene = new DashboardScene({ title: 'hello', uid: 'dash-1' });

    await applyDefaultSavedViewToUrl(scene);

    expect(partialSpy).not.toHaveBeenCalled();
  });
});
