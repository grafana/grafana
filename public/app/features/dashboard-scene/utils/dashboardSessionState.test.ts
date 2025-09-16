import { config, locationService } from '@grafana/runtime';
import { CustomVariable, UrlSyncManager } from '@grafana/scenes';
import { DashboardDataDTO } from 'app/types/dashboard';

import { transformSaveModelToScene } from '../serialization/transformSaveModelToScene';

import {
  PRESERVED_SCENE_STATE_KEY,
  preserveDashboardSceneStateInLocalStorage,
  restoreDashboardStateFromLocalStorage,
} from './dashboardSessionState';

describe('dashboardSessionState', () => {
  beforeAll(() => {
    config.featureToggles.preserveDashboardStateWhenNavigating = true;
  });

  afterAll(() => {
    config.featureToggles.preserveDashboardStateWhenNavigating = false;
  });

  beforeEach(() => {});

  describe('behavior', () => {
    it('should do nothing if no uid', () => {
      expect(window.sessionStorage.getItem(PRESERVED_SCENE_STATE_KEY)).toBeNull();

      preserveDashboardSceneStateInLocalStorage({} as URLSearchParams, undefined);

      expect(window.sessionStorage.getItem(PRESERVED_SCENE_STATE_KEY)).toBeNull();
    });

    it('should capture dashboard scene state and save it to session storage', () => {
      const params = new URLSearchParams('from=now-6h&to=now&timezone=browser&var-customVar=a');

      expect(window.sessionStorage.getItem(PRESERVED_SCENE_STATE_KEY)).toBeNull();

      preserveDashboardSceneStateInLocalStorage(params, 'uid');

      expect(window.sessionStorage.getItem(PRESERVED_SCENE_STATE_KEY)).toBe(
        '?from=now-6h&to=now&timezone=browser&var-customVar=a'
      );
    });
  });

  describe('restoreDashboardStateFromLocalStorage', () => {
    it('should restore dashboard state from session storage', () => {
      window.sessionStorage.setItem(PRESERVED_SCENE_STATE_KEY, '?var-customVar=b&from=now-5m&to=now&timezone=browser');
      const scene = buildTestScene();

      restoreDashboardStateFromLocalStorage(scene);
      const variable = scene.state.$variables!.getByName('customVar') as CustomVariable;
      const timeRange = scene.state.$timeRange;

      const urlSyncManager = new UrlSyncManager();
      urlSyncManager.initSync(scene);

      expect(variable!.state!.value).toEqual(['b']);
      expect(variable!.state!.text).toEqual(['b']);
      expect(timeRange?.state.from).toEqual('now-5m');
      expect(timeRange?.state.to).toEqual('now');
    });

    it('should use preserved state filters if current location has empty filters state', () => {
      // we have a saved state with filters set
      window.sessionStorage.setItem(
        PRESERVED_SCENE_STATE_KEY,
        '?var-customVar=b&var-nonApplicableVar=b&from=now-5m&to=now&timezone=browser&var-filters=cluster%7C%3D%7Cdev&var-filters=test'
      );

      // but the target location also has filters key with an empty state
      locationService.replace({
        search: 'var-customVar=b&from=now-5m&to=now&timezone=browser&var-filters=',
      });

      // var-filters must also be set on the scene otherwise restore fn will drop the filter url key
      const scene = buildTestScene({
        templating: {
          list: [
            {
              multi: true,
              name: 'customVar',
              query: 'a,b,c',
              type: 'custom',
            },
            {
              name: 'filters',
              type: 'adhoc',
            },
          ],
        },
      });

      restoreDashboardStateFromLocalStorage(scene);

      expect(locationService.getLocation().search).toBe(
        '?var-customVar=b&from=now-5m&to=now&timezone=browser&var-filters=cluster%7C%3D%7Cdev&var-filters=test'
      );

      jest.clearAllMocks();
    });

    it('should remove query params that are not applicable on a target dashboard', () => {
      window.sessionStorage.setItem(
        PRESERVED_SCENE_STATE_KEY,
        '?var-customVar=b&var-nonApplicableVar=b&from=now-5m&to=now&timezone=browser'
      );

      const scene = buildTestScene();

      restoreDashboardStateFromLocalStorage(scene);

      expect(locationService.getLocation().search).toBe('?var-customVar=b&from=now-5m&to=now&timezone=browser');
    });

    // handles case when user navigates back to a dashboard with the same state, i.e. using back button
    it('should remove duplicate query params', () => {
      locationService.replace({ search: 'var-customVar=b&from=now-6h&to=now&timezone=browser' });

      window.sessionStorage.setItem(PRESERVED_SCENE_STATE_KEY, '?var-customVar=b&from=now-5m&to=now&timezone=browser');
      const scene = buildTestScene();

      restoreDashboardStateFromLocalStorage(scene);

      expect(locationService.getLocation().search).toBe('?var-customVar=b&from=now-6h&to=now&timezone=browser');
    });
  });
});

function buildTestScene(overrides?: Partial<DashboardDataDTO>) {
  const testDashboard: DashboardDataDTO = {
    annotations: { list: [] },
    editable: true,
    fiscalYearStartMonth: 0,
    graphTooltip: 0,
    id: 2483,
    links: [],
    panels: [],
    schemaVersion: 39,
    tags: [],
    templating: {
      list: [
        {
          multi: true,
          name: 'customVar',
          query: 'a,b,c',
          type: 'custom',
        },
      ],
    },
    time: {
      from: 'now-6h',
      to: 'now',
    },
    timepicker: {},
    timezone: 'browser',
    title: 'Test dashboard',
    uid: 'edhmd9stpd6o0a',
    version: 24,
    weekStart: '',
    ...overrides,
  };

  const scene = transformSaveModelToScene({ dashboard: testDashboard, meta: {} });

  // Removing data layers to avoid mocking built-in Grafana data source
  scene.setState({ $data: undefined });

  return scene;
}
