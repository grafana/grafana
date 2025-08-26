import { SceneTimeRange } from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';
import { activateFullSceneTree } from '../utils/test-utils';

import { VERSIONS_FETCH_LIMIT, VersionsEditView } from './VersionsEditView';
import { historySrv } from './version-history/HistorySrv';

jest.mock('./version-history/HistorySrv');

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
      expect(versions[0].ageString).toBeDefined();
      expect(versions[1].createdDateString).toBe('2017-02-22 20:43:01');
      expect(versions[1].ageString).toBeDefined();
      expect(versions[2].createdDateString).toBe('2017-02-23 20:43:01');
      expect(versions[2].ageString).toBeDefined();
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

    it('should correctly identify last page when partial page is returned without version 1', async () => {
      jest.mocked(historySrv.getHistoryList).mockResolvedValueOnce({
        continueToken: '',
        versions: [
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
        ],
      });

      versionsView.reset();
      versionsView.fetchVersions();
      await new Promise(process.nextTick);

      expect(versionsView.versions.length).toBeLessThan(VERSIONS_FETCH_LIMIT);
      expect(versionsView.versions.find((rev) => rev.version === 1)).toBeUndefined();
    });

    it('should correctly identify last page when continueToken is empty', async () => {
      jest.mocked(historySrv.getHistoryList).mockResolvedValueOnce({
        continueToken: '',
        versions: [
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
        ],
      });

      versionsView.reset();
      versionsView.fetchVersions();
      await new Promise(process.nextTick);

      expect(versionsView.versions.length).toBeLessThan(VERSIONS_FETCH_LIMIT);
      expect(versionsView.versions.find((rev) => rev.version === 1)).toBeUndefined();
      expect(versionsView.continueToken).toBe('');
    });
  });
});

function getVersions() {
  return {
    continueToken: '',
    versions: [
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
    ],
  };
}

async function buildTestScene() {
  const versionsView = new VersionsEditView({});
  const dashboard = new DashboardScene({
    $timeRange: new SceneTimeRange({}),
    title: 'hello',
    uid: 'dash-1',
    version: 4,
    meta: {
      canEdit: true,
    },
    editview: versionsView,
  });

  activateFullSceneTree(dashboard);

  await new Promise((r) => setTimeout(r, 1));

  dashboard.onEnterEditMode();
  versionsView.activate();

  return { dashboard, versionsView };
}
