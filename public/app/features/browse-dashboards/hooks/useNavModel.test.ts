import { getWrapper, renderHook, waitFor } from 'test/test-utils';

import { config, setBackendSrv } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { folderHandlers } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';
import { getAlertingTabID, getDashboardsTabID, getLibraryPanelsTabID } from 'app/features/folders/state/navModel';
import { type FolderDTO } from 'app/types/folders';

import { useNavModel } from './useNavModel';

setBackendSrv(backendSrv);
setupMockServer();

jest.mock('app/core/services/context_srv', () => ({
  ...jest.requireActual('app/core/services/context_srv'),
  contextSrv: {
    ...jest.requireActual('app/core/services/context_srv').contextSrv,
    hasPermission: () => true,
  },
}));

const folder: FolderDTO = {
  uid: 'test-folder-uid',
  title: 'Test Folder',
  url: '/dashboards/f/test-folder-uid',
  id: 1,
  created: '',
  createdBy: '',
  hasAcl: false,
  updated: '',
  updatedBy: '',
  canSave: true,
  canEdit: true,
  canAdmin: true,
  canDelete: true,
  version: 1,
};

const renderUseNavModel = (folderDTO: FolderDTO | undefined, tab: 'dashboards' | 'panels' | 'alerts') =>
  renderHook(() => useNavModel(folderDTO, tab), { wrapper: getWrapper({}) });

describe('useNavModel', () => {
  const originalUnifiedAlerting = config.unifiedAlertingEnabled;

  beforeEach(() => {
    config.unifiedAlertingEnabled = true;
  });

  afterAll(() => {
    config.unifiedAlertingEnabled = originalUnifiedAlerting;
  });

  it('returns undefined when folderDTO is not provided', () => {
    const { result } = renderUseNavModel(undefined, 'dashboards');
    expect(result.current).toBeUndefined();
  });

  it('marks the dashboards tab as active', () => {
    const { result } = renderUseNavModel(folder, 'dashboards');
    const dashboardsTab = result.current?.children?.find((c) => c.id === getDashboardsTabID(folder.uid));
    expect(dashboardsTab?.active).toBe(true);
  });

  it('marks the panels tab as active', () => {
    const { result } = renderUseNavModel(folder, 'panels');
    const panelsTab = result.current?.children?.find((c) => c.id === getLibraryPanelsTabID(folder.uid));
    expect(panelsTab?.active).toBe(true);
  });

  it('marks the alerts tab as active', () => {
    const { result } = renderUseNavModel(folder, 'alerts');
    const alertingTab = result.current?.children?.find((c) => c.id === getAlertingTabID(folder.uid));
    expect(alertingTab?.active).toBe(true);
  });

  it('populates tab counters from the folder counts query', async () => {
    server.use(folderHandlers.mockFolderCountsHandler(7, 3));
    const { result } = renderUseNavModel(folder, 'dashboards');

    await waitFor(() => {
      const panelsTab = result.current?.children?.find((c) => c.id === getLibraryPanelsTabID(folder.uid));
      expect(panelsTab?.tabCounter).toBe(7);
    });

    const alertingTab = result.current?.children?.find((c) => c.id === getAlertingTabID(folder.uid));
    expect(alertingTab?.tabCounter).toBe(3);
  });

  it('leaves tab counters undefined when the counts query fails', async () => {
    server.use(folderHandlers.mockFolderCountsErrorHandler());
    const { result } = renderUseNavModel(folder, 'dashboards');

    await waitFor(() => {
      expect(result.current).toBeDefined();
    });

    const panelsTab = result.current?.children?.find((c) => c.id === getLibraryPanelsTabID(folder.uid));
    const alertingTab = result.current?.children?.find((c) => c.id === getAlertingTabID(folder.uid));
    expect(panelsTab?.tabCounter).toBeUndefined();
    expect(alertingTab?.tabCounter).toBeUndefined();
  });
});
