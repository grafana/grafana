import { SceneGridItem, SceneGridLayout, SceneTimeRange } from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';
import { activateFullSceneTree } from '../utils/test-utils';

import { VERSIONS_FETCH_LIMIT, VersionsEditView } from './VersionsEditView';
import { historySrv } from './version-history';

jest.mock('./version-history/HistorySrv');

describe('VersionsEditView', () => {
  describe('Dashboard Versions state', () => {
    let dashboard: DashboardScene;
    let versionsView: VersionsEditView;

    beforeEach(async () => {
      jest.mocked(historySrv.getHistoryList).mockResolvedValue(getVersions());

      const result = await buildTestScene();
      dashboard = result.dashboard;
      versionsView = result.versionsView;
    });

    it('should return the correct urlKey', () => {
      expect(versionsView.getUrlKey()).toBe('versions');
    });

    it('should return the dashboard', () => {
      expect(versionsView.getDashboard()).toBe(dashboard);
    });

    it('should return the decorated list of versions', () => {
      const versions = versionsView.versions;

      expect(versions).toHaveLength(2);
      expect(versions[0].createdDateString).toBe('2017-02-22 20:43:01');
      expect(versions[0].ageString).toBe('7 years ago');
      expect(versions[1].createdDateString).toBe('2017-02-22 20:43:01');
      expect(versions[1].ageString).toBe('7 years ago');
    });

    it('should bump the start threshold when fetching more versions', async () => {
      expect(versionsView.start).toBe(VERSIONS_FETCH_LIMIT);

      versionsView.fetchVersions(true);
      await new Promise(process.nextTick);

      expect(versionsView.start).toBe(VERSIONS_FETCH_LIMIT * 2);
    });
  });
});

function getVersions() {
  return [
    {
      id: 4,
      dashboardId: 1,
      dashboardUID: '_U4zObQMz',
      parentVersion: 3,
      restoredFrom: 0,
      version: 4,
      created: '2017-02-22T17:43:01-08:00',
      createdBy: 'admin',
      message: '',
    },
    {
      id: 3,
      dashboardId: 1,
      dashboardUID: '_U4zObQMz',
      parentVersion: 1,
      restoredFrom: 1,
      version: 3,
      created: '2017-02-22T17:43:01-08:00',
      createdBy: 'admin',
      message: '',
    },
  ];
}

async function buildTestScene() {
  const versionsView = new VersionsEditView({ versions: [] });
  const dashboard = new DashboardScene({
    $timeRange: new SceneTimeRange({}),
    title: 'hello',
    uid: 'dash-1',
    meta: {
      canEdit: true,
    },
    body: new SceneGridLayout({
      children: [
        new SceneGridItem({
          key: 'griditem-1',
          x: 0,
          y: 0,
          width: 10,
          height: 12,
          body: undefined,
        }),
      ],
    }),
    editview: versionsView,
  });

  activateFullSceneTree(dashboard);

  await new Promise((r) => setTimeout(r, 1));

  dashboard.onEnterEditMode();
  versionsView.activate();

  return { dashboard, versionsView };
}
