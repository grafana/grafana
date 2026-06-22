import { render as RTLRender, screen } from '@testing-library/react';
import * as React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';

import { SceneTimeRange } from '@grafana/scenes';
import { VERSIONS_FETCH_LIMIT } from 'app/features/dashboard/types/revisionModels';
import { type DashboardMeta } from 'app/types/dashboard';

import { DashboardScene } from '../scene/DashboardScene';
import { activateFullSceneTree } from '../utils/test-utils';

import { VersionsEditView } from './VersionsEditView';
import * as DashboardTemplateExtensionModule from './enterprise-components/DashboardTemplateExtension';

function render(component: React.ReactNode) {
  return RTLRender(<TestProvider>{component}</TestProvider>);
}

const mockListDashboardHistory = jest.fn();

jest.mock('app/features/dashboard/api/dashboard_api', () => ({
  getDashboardAPI: () =>
    Promise.resolve({
      listDashboardHistory: mockListDashboardHistory,
    }),
}));

const mockUseGetDisplayMappingQuery = jest.fn();

jest.mock('app/api/clients/iam/v0alpha1', () => ({
  useGetDisplayMappingQuery: (...args: unknown[]) => mockUseGetDisplayMappingQuery(...args),
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

  describe('Display name resolution', () => {
    beforeEach(() => {
      mockUseGetDisplayMappingQuery.mockReset();
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should map display names by identity, not array index', async () => {
      mockListDashboardHistory.mockResolvedValue({
        metadata: { continue: '' },
        items: [
          createTestResource(2, '2024-01-02T00:00:00Z', 'user:uid-ryan'),
          createTestResource(1, '2024-01-01T00:00:00Z', 'user:uid-bhaskar'),
        ],
      });

      mockUseGetDisplayMappingQuery.mockReturnValue({
        data: {
          keys: ['user:uid-ryan', 'user:uid-bhaskar'],
          display: [
            { identity: { type: 'user', name: 'uid-bhaskar' }, displayName: 'Bhaskar Surroy' },
            { identity: { type: 'user', name: 'uid-ryan' }, displayName: 'Ryan Brown' },
          ],
        },
      });

      const { versionsView } = await buildTestScene();
      render(<versionsView.Component model={versionsView} />);

      expect(await screen.findByText('Ryan Brown')).toBeInTheDocument();
      expect(screen.getByText('Bhaskar Surroy')).toBeInTheDocument();

      const rows = screen.getAllByRole('row');
      // row 0 is the header; row 1 is version 2 (Ryan), row 2 is version 1 (Bhaskar)
      expect(rows[1]).toHaveTextContent('Ryan Brown');
      expect(rows[2]).toHaveTextContent('Bhaskar Surroy');
    });

    it('should use createdBy annotation as fallback for initial version without updatedBy', async () => {
      mockListDashboardHistory.mockResolvedValue({
        metadata: { continue: '' },
        items: [
          createTestResource(2, '2024-01-02T00:00:00Z', 'user:uid-editor'),
          createTestResourceWithCreatedByOnly(1, '2024-01-01T00:00:00Z', 'user:uid-creator'),
        ],
      });

      mockUseGetDisplayMappingQuery.mockReturnValue({
        data: {
          keys: ['user:uid-editor', 'user:uid-creator'],
          display: [
            { identity: { type: 'user', name: 'uid-creator' }, displayName: 'Creator User' },
            { identity: { type: 'user', name: 'uid-editor' }, displayName: 'Editor User' },
          ],
        },
      });

      const { versionsView } = await buildTestScene();
      render(<versionsView.Component model={versionsView} />);

      expect(await screen.findByText('Editor User')).toBeInTheDocument();
      expect(screen.getByText('Creator User')).toBeInTheDocument();

      const rows = screen.getAllByRole('row');
      expect(rows[1]).toHaveTextContent('Editor User');
      expect(rows[2]).toHaveTextContent('Creator User');
    });

    it('should fall back to raw key when user is not found in display data', async () => {
      mockListDashboardHistory.mockResolvedValue({
        metadata: { continue: '' },
        items: [createTestResource(1, '2024-01-01T00:00:00Z', 'user:uid-unknown')],
      });

      mockUseGetDisplayMappingQuery.mockReturnValue({
        data: { keys: ['user:uid-unknown'], display: [], invalidKeys: ['user:uid-unknown'] },
      });

      const { versionsView } = await buildTestScene();
      render(<versionsView.Component model={versionsView} />);

      expect(await screen.findByText('user:uid-unknown')).toBeInTheDocument();
    });

    it('does not crash when the display mapping response has a null display field', async () => {
      mockListDashboardHistory.mockResolvedValue({
        metadata: { continue: '' },
        items: [createTestResource(1, '2024-01-01T00:00:00Z', 'user:uid-unknown')],
      });

      // The IAM display endpoint marshals an unresolved (nil) slice as `null`,
      // so display can be null even when the response object is present.
      mockUseGetDisplayMappingQuery.mockReturnValue({
        data: { keys: ['user:uid-unknown'], display: null, invalidKeys: ['user:uid-unknown'] },
      });

      const { versionsView } = await buildTestScene();
      render(<versionsView.Component model={versionsView} />);

      expect(await screen.findByText('user:uid-unknown')).toBeInTheDocument();
    });
  });

  describe('Template dashboards', () => {
    const mockListHistory = jest.fn();
    const mockRestore = jest.fn();
    const mockLoadTemplate = jest.fn();

    beforeEach(() => {
      mockListHistory.mockReset();
      mockRestore.mockReset();
      mockLoadTemplate.mockReset();
      mockListDashboardHistory.mockReset();
      jest.spyOn(DashboardTemplateExtensionModule, 'getDashboardTemplateExtension').mockReturnValue({
        loadTemplate: mockLoadTemplate,
        listHistory: mockListHistory,
        restore: mockRestore,
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('fetches history via the DashboardTemplateExtension and not the dashboard API', async () => {
      mockListHistory.mockResolvedValue({
        metadata: { continue: '' },
        items: [createTestResource(2, '2024-01-02T00:00:00Z')],
      });

      const { versionsView } = await buildTestScene({
        isDashboardTemplate: true,
        dashboardTemplateUid: 'tpl-1',
      });

      versionsView.reset();
      versionsView.fetchVersions();
      await new Promise(process.nextTick);

      expect(mockListHistory).toHaveBeenCalled();
      const [calledUid, calledOpts] = mockListHistory.mock.calls[0];
      expect(calledUid).toBe('tpl-1');
      expect(calledOpts).toMatchObject({ limit: VERSIONS_FETCH_LIMIT });
      expect(mockListDashboardHistory).not.toHaveBeenCalled();
    });

    it('extracts spec.dashboard into revision data so the version diff compares embedded dashboards', async () => {
      mockListHistory.mockResolvedValue({
        metadata: { continue: '' },
        items: [
          {
            apiVersion: 'v0alpha1',
            kind: 'DashboardTemplate',
            metadata: {
              name: 'tpl-1',
              generation: 7,
              creationTimestamp: '2024-01-02T00:00:00Z',
              annotations: {},
            },
            spec: {
              title: 'wrapper title — should be ignored',
              dashboard: { schemaVersion: 41, panels: [{ id: 1 }] },
            },
          },
        ],
      });

      const { versionsView } = await buildTestScene({
        isDashboardTemplate: true,
        dashboardTemplateUid: 'tpl-1',
      });

      versionsView.reset();
      versionsView.fetchVersions();
      await new Promise(process.nextTick);

      expect(versionsView.versions).toHaveLength(1);
      expect(versionsView.versions[0].data).toEqual({ schemaVersion: 41, panels: [{ id: 1 }] });
    });

    it('is a no-op when neither uid nor dashboardTemplateUid is set', async () => {
      const versionsView = new VersionsEditView({});
      const dashboard = new DashboardScene({
        $timeRange: new SceneTimeRange({}),
        uid: '',
        meta: { canEdit: true, isDashboardTemplate: true },
        editview: versionsView,
      });
      activateFullSceneTree(dashboard);
      await new Promise((r) => setTimeout(r, 1));
      dashboard.onEnterEditMode();
      versionsView.activate();

      versionsView.reset();
      versionsView.fetchVersions();
      await new Promise(process.nextTick);

      expect(mockListHistory).not.toHaveBeenCalled();
      expect(mockListDashboardHistory).not.toHaveBeenCalled();
    });
  });
});

function createTestResource(version: number, created: string, updatedBy = 'admin') {
  return {
    apiVersion: 'v1beta1',
    kind: 'Dashboard',
    metadata: {
      name: '_U4zObQMz',
      generation: version,
      creationTimestamp: created,
      annotations: {
        'grafana.app/updatedBy': updatedBy,
        'grafana.app/message': '',
      },
    },
    spec: { version },
  };
}

function createTestResourceWithCreatedByOnly(version: number, created: string, createdBy: string) {
  return {
    apiVersion: 'v1beta1',
    kind: 'Dashboard',
    metadata: {
      name: '_U4zObQMz',
      generation: version,
      creationTimestamp: created,
      annotations: {
        'grafana.app/createdBy': createdBy,
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

async function buildTestScene(metaOverrides: Partial<DashboardMeta> = {}) {
  const versionsView = new VersionsEditView({});
  const dashboard = new DashboardScene({
    $timeRange: new SceneTimeRange({}),
    title: 'hello',
    uid: 'dash-1',
    version: 4,
    meta: {
      canEdit: true,
      ...metaOverrides,
    },
    editview: versionsView,
  });

  activateFullSceneTree(dashboard);

  await new Promise((r) => setTimeout(r, 1));

  dashboard.onEnterEditMode();
  versionsView.activate();

  return { dashboard, versionsView };
}
