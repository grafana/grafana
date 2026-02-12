import { SceneTimeRange } from '@grafana/scenes';
import { VERSIONS_FETCH_LIMIT } from 'app/features/dashboard/types/revisionModels';

import { DashboardScene } from '../scene/DashboardScene';
import { activateFullSceneTree } from '../utils/test-utils';

import { VersionsEditView } from './VersionsEditView';

const mockListDashboardHistory = jest.fn();

jest.mock('app/features/dashboard/api/dashboard_api', () => ({
  getDashboardAPI: () => ({
    listDashboardHistory: mockListDashboardHistory,
  }),
}));

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
      mockListDashboardHistory.mockResolvedValue(getVersionsAsResourceList());

      const result = await buildTestScene();
      dashboard = result.dashboard;
      versionsView = result.versionsView;
    });

    afterEach(() => {
      jest.clearAllMocks();
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

    it('should set the diffData from already-loaded versions', () => {
      versionsView.onCheck(mockEvent, 3);
      versionsView.onCheck(mockEvent, 4);

      // getDiff now uses already-loaded data, no API call needed
      versionsView.getDiff();

      // Data comes from the versions loaded by listDashboardHistory
      expect(versionsView.diffData).toEqual({
        lhs: { version: 3 },
        rhs: { version: 4 },
      });
      expect(versionsView.state.baseInfo).toHaveProperty('version', 3);
      expect(versionsView.state.newInfo).toHaveProperty('version', 4);
    });

    it('should set the isNewLatest flag if the new selected version is latest', () => {
      versionsView.onCheck(mockEvent, 4);
      versionsView.onCheck(mockEvent, 2);

      // getDiff now uses already-loaded data, no API call needed
      versionsView.getDiff();

      expect(versionsView.state.isNewLatest).toBe(true);
    });

    it('should correctly identify last page when partial page is returned without version 1', async () => {
      mockListDashboardHistory.mockResolvedValueOnce({
        metadata: { continue: '' },
        items: [createTestResource(4, '2017-02-22T17:43:01-08:00'), createTestResource(3, '2017-02-22T17:43:01-08:00')],
      });

      versionsView.reset();
      versionsView.fetchVersions();
      await new Promise(process.nextTick);

      expect(versionsView.versions.length).toBeLessThan(VERSIONS_FETCH_LIMIT);
      expect(versionsView.versions.find((rev) => rev.version === 1)).toBeUndefined();
    });

    it('should correctly identify last page when continueToken is empty', async () => {
      mockListDashboardHistory.mockResolvedValueOnce({
        metadata: { continue: '' },
        items: [createTestResource(4, '2017-02-22T17:43:01-08:00'), createTestResource(3, '2017-02-22T17:43:01-08:00')],
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

function createTestResource(version: number, created: string) {
  return {
    apiVersion: 'v1beta1',
    kind: 'Dashboard',
    metadata: {
      name: '_U4zObQMz',
      generation: version,
      creationTimestamp: created,
      annotations: {
        'grafana.app/updatedBy': 'admin',
        'grafana.app/message': '',
      },
    },
    spec: { version },
  };
}

function getVersionsAsResourceList() {
  return {
    metadata: { continue: '' },
    items: [
      createTestResource(4, '2017-02-22T17:43:01-08:00'),
      createTestResource(3, '2017-02-22T17:43:01-08:00'),
      createTestResource(2, '2017-02-23T17:43:01-08:00'),
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
