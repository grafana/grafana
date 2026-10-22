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

  it('writes ?viewFilter= for a stored default when the url has none, replacing rather than pushing', async () => {
    mockGetDefaultSavedView.mockResolvedValue('view-1');
    getMock.mockResolvedValue(buildView('view-1'));
    const scene = new DashboardScene({ title: 'hello', uid: 'dash-1' });

    await applyDefaultSavedViewToUrl(scene);

    // The `true` second argument is the replace flag -- this write is initialization, not a real
    // user navigation, so it must not push a second history entry for the same dashboard.
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

  it.each([404, 401, 403])(
    'self-heals a stored default on a terminal %i failure, and never writes it to the url',
    async (status) => {
      mockGetDefaultSavedView.mockResolvedValue('view-deleted');
      getMock.mockRejectedValue({ status, data: {}, config: {} });
      const scene = new DashboardScene({ title: 'hello', uid: 'dash-1' });

      await applyDefaultSavedViewToUrl(scene);

      expect(mockSetDefaultSavedView).toHaveBeenCalledWith('dash-1', undefined);
      expect(partialSpy).not.toHaveBeenCalled();
    }
  );

  it('does not self-heal on a transient failure (no status, or a 5xx) -- leaves the stored default intact', async () => {
    mockGetDefaultSavedView.mockResolvedValue('view-1');
    getMock.mockRejectedValue({ status: 503, data: {}, config: {} });
    const scene = new DashboardScene({ title: 'hello', uid: 'dash-1' });

    await applyDefaultSavedViewToUrl(scene);

    expect(mockSetDefaultSavedView).not.toHaveBeenCalled();
    expect(partialSpy).not.toHaveBeenCalled();
  });

  it('does not self-heal on a plain network error with no status at all', async () => {
    mockGetDefaultSavedView.mockResolvedValue('view-1');
    getMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const scene = new DashboardScene({ title: 'hello', uid: 'dash-1' });

    await applyDefaultSavedViewToUrl(scene);

    expect(mockSetDefaultSavedView).not.toHaveBeenCalled();
    expect(partialSpy).not.toHaveBeenCalled();
  });

  it('does not write viewFilter if the viewer navigated to a different dashboard while the default lookup was in flight', async () => {
    mockGetDefaultSavedView.mockImplementation(async () => {
      currentPathname = '/d/dash-2/a-different-dashboard'; // navigated away mid-await
      return 'view-1';
    });
    const scene = new DashboardScene({ title: 'hello', uid: 'dash-1' });

    await applyDefaultSavedViewToUrl(scene);

    expect(getMock).not.toHaveBeenCalled();
    expect(partialSpy).not.toHaveBeenCalled();
  });

  it('does not write viewFilter if the viewer navigated away while the view fetch was in flight', async () => {
    mockGetDefaultSavedView.mockResolvedValue('view-1');
    getMock.mockImplementation(async () => {
      currentPathname = '/d/dash-2/a-different-dashboard'; // navigated away mid-await
      return buildView('view-1');
    });
    const scene = new DashboardScene({ title: 'hello', uid: 'dash-1' });

    await applyDefaultSavedViewToUrl(scene);

    expect(partialSpy).not.toHaveBeenCalled();
  });
});
