import { SceneGridItem, SceneGridLayout, SceneTimeRange } from '@grafana/scenes';
import { Dashboard } from '@grafana/schema';

import { DashboardScene } from '../scene/DashboardScene';
import { transformSaveModelToScene } from '../serialization/transformSaveModelToScene';
import { activateFullSceneTree } from '../utils/test-utils';

import { DecoratedRevisionModel, VERSIONS_FETCH_LIMIT, VersionsEditView } from './VersionsEditView';
import { historySrv } from './version-history';

jest.mock('./version-history/HistorySrv');
jest.mock('../serialization/transformSaveModelToScene');

describe('VersionsEditView', () => {
  describe('Dashboard versions state', () => {
    let dashboard: DashboardScene;
    let versionsView: VersionsEditView;
    const mockEvent = {
      preventDefault: jest.fn(),
      currentTarget: {
        checked: true,
      },
    } as unknown as React.FormEvent<HTMLInputElement>;

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

      expect(versions).toHaveLength(3);
      expect(versions[0].createdDateString).toBe('2017-02-22 20:43:01');
      expect(versions[0].ageString).toBe('7 years ago');
      expect(versions[1].createdDateString).toBe('2017-02-22 20:43:01');
      expect(versions[1].ageString).toBe('7 years ago');
      expect(versions[2].createdDateString).toBe('2017-02-23 20:43:01');
      expect(versions[2].ageString).toBe('7 years ago');
    });

    it('should bump the start threshold when fetching more versions', async () => {
      expect(versionsView.start).toBe(VERSIONS_FETCH_LIMIT);

      versionsView.fetchVersions(true);
      await new Promise(process.nextTick);

      expect(versionsView.start).toBe(VERSIONS_FETCH_LIMIT * 2);
    });

    it('should set the state of a version as checked when onCheck is called', () => {
      versionsView.onCheck(mockEvent, 3);

      expect(versionsView.versions[0].checked).toBe(false);
      expect(versionsView.versions[1].checked).toBe(true);
      expect(versionsView.versions[2].checked).toBe(false);
    });

    it('should reset the state of all versions when reset is called', () => {
      versionsView.onCheck(mockEvent, 3);

      expect(versionsView.versions[1].checked).toBe(true);

      versionsView.reset();

      expect(versionsView.versions[0].checked).toBe(false);
      expect(versionsView.versions[1].checked).toBe(false);
      expect(versionsView.versions[2].checked).toBe(false);
    });

    it('should set the diffData', async () => {
      versionsView.onCheck(mockEvent, 3);
      versionsView.onCheck(mockEvent, 4);

      jest
        .mocked(historySrv.getDashboardVersion)
        .mockResolvedValueOnce({ data: 'lhs' })
        .mockResolvedValue({ data: 'rhs' });

      await versionsView.getDiff();

      expect(versionsView.diffData).toEqual({
        lhs: 'lhs',
        rhs: 'rhs',
      });
      expect(versionsView.state.baseInfo).toHaveProperty('version', 3);
      expect(versionsView.state.newInfo).toHaveProperty('version', 4);
    });

    it('should set the isNewLatest flag if the new selected version is latest', async () => {
      versionsView.onCheck(mockEvent, 4);
      versionsView.onCheck(mockEvent, 2);

      jest
        .mocked(historySrv.getDashboardVersion)
        .mockResolvedValueOnce({ data: 'lhs' })
        .mockResolvedValue({ data: 'rhs' });

      await versionsView.getDiff();

      expect(versionsView.state.isNewLatest).toBe(true);
    });

    it('should restore the dashboard to the selected version and exit edit mode', async () => {
      const newVersion = 3;

      const mockScene = new DashboardScene({
        title: 'new name',
        uid: 'dash-1',
        version: 4,
      });

      jest.mocked(historySrv.restoreDashboard).mockResolvedValue({ version: newVersion });
      jest.mocked(transformSaveModelToScene).mockReturnValue(mockScene);

      return versionsView.onRestore(getVersionMock()).then((res) => {
        expect(res).toBe(true);

        expect(dashboard.state.version).toBe(newVersion);
        expect(dashboard.state.title).toBe('new name');
        expect(dashboard.state.isEditing).toBe(false);
      });
    });

    it('should return early if historySrv does not return a valid version number', async () => {
      jest.mocked(historySrv.restoreDashboard).mockResolvedValue({ version: null });

      return versionsView.onRestore(getVersionMock()).then((res) => {
        expect(res).toBe(false);
      });
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
      checked: false,
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
      checked: false,
    },
    {
      id: 2,
      dashboardId: 1,
      dashboardUID: '_U4zObQMz',
      parentVersion: 1,
      restoredFrom: 1,
      version: 2,
      created: '2017-02-23T17:43:01-08:00',
      createdBy: 'admin',
      message: '',
      checked: false,
    },
  ];
}

function getVersionMock(): DecoratedRevisionModel {
  const dash: Dashboard = {
    title: 'new name',
    id: 5,
    schemaVersion: 30,
  };

  return {
    id: 2,
    checked: false,
    uid: 'uid',
    parentVersion: 1,
    version: 2,
    created: new Date(),
    createdBy: 'admin',
    message: '',
    data: dash,
    createdDateString: '2017-02-22 20:43:01',
    ageString: '7 years ago',
  };
}

async function buildTestScene() {
  const versionsView = new VersionsEditView({ versions: [] });
  const dashboard = new DashboardScene({
    $timeRange: new SceneTimeRange({}),
    title: 'hello',
    uid: 'dash-1',
    version: 4,
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
