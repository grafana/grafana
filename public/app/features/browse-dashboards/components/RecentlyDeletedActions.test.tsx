import { render, screen } from 'test/test-utils';

import { DataFrameView, FieldType, toDataFrame } from '@grafana/data';
import { setBackendSrv } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';

import { backendSrv } from 'app/core/services/backend_srv';

import { deletedDashboardsCache } from '../../search/service/deletedDashboardsCache';
import { DashboardQueryResult } from '../../search/service/types';
import { SearchLayout, EventTrackingNamespace } from '../../search/types';
import { TrashStateManager, useRecentlyDeletedStateManager } from '../api/useRecentlyDeletedStateManager';
import { useActionSelectionState } from '../state/hooks';

import { RecentlyDeletedActions } from './RecentlyDeletedActions';

jest.mock('../api/useRecentlyDeletedStateManager');
jest.mock('../state/hooks');
jest.mock('../../search/service/deletedDashboardsCache');

setBackendSrv(backendSrv);
setupMockServer();

const mockUseRecentlyDeletedStateManager = useRecentlyDeletedStateManager as jest.MockedFunction<
  typeof useRecentlyDeletedStateManager
>;
const mockUseActionSelectionState = useActionSelectionState as jest.MockedFunction<typeof useActionSelectionState>;

describe('RecentlyDeletedActions', () => {
  const mockDoSearchWithDebounce = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    const mockDataFrame = toDataFrame({
      name: 'DeletedDashboards',
      fields: [
        { name: 'kind', type: FieldType.string, config: {}, values: ['dashboard'] },
        { name: 'name', type: FieldType.string, config: {}, values: ['Test Dashboard'] },
        { name: 'uid', type: FieldType.string, config: {}, values: ['dashboard-1'] },
        { name: 'url', type: FieldType.string, config: {}, values: ['/d/dashboard-1'] },
        { name: 'panel_type', type: FieldType.string, config: {}, values: [''] },
        { name: 'tags', type: FieldType.other, config: {}, values: [[]] },
        { name: 'location', type: FieldType.string, config: {}, values: ['folder-1'] },
        { name: 'ds_uid', type: FieldType.other, config: {}, values: [[]] },
        { name: 'score', type: FieldType.number, config: {}, values: [0] },
        { name: 'explain', type: FieldType.other, config: {}, values: [{}] },
      ],
    });

    const mockView = new DataFrameView<DashboardQueryResult>(mockDataFrame);

    const mockStateManager = {
      doSearchWithDebounce: mockDoSearchWithDebounce,
      state: {
        query: '',
        tag: [],
        starred: false,
        layout: SearchLayout.List,
        deleted: true,
        eventTrackingNamespace: 'manage_dashboards' as EventTrackingNamespace,
        result: {
          view: mockView,
        },
      },
    } as unknown as TrashStateManager;

    mockUseRecentlyDeletedStateManager.mockReturnValue([
      {
        query: '',
        tag: [],
        starred: false,
        layout: SearchLayout.List,
        deleted: true,
        eventTrackingNamespace: 'manage_dashboards',
        result: {
          view: mockView,
          loadMoreItems: function (startIndex: number, stopIndex: number): Promise<void> {
            return Promise.resolve();
          },
          isItemLoaded: function (index: number) {
            return true;
          },
          totalRows: 0,
        },
      },
      mockStateManager,
    ]);

    (deletedDashboardsCache.clear as jest.Mock) = jest.fn();
    (deletedDashboardsCache.getAsResourceList as jest.Mock) = jest.fn().mockResolvedValue({
      items: [
        {
          metadata: { name: 'dashboard-1' },
        },
      ],
    });
  });

  it('renders restore button', () => {
    mockUseActionSelectionState.mockReturnValue({
      dashboard: {},
      folder: {},
    });

    render(<RecentlyDeletedActions />);

    expect(screen.getByRole('button', { name: 'Restore' })).toBeInTheDocument();
  });

  it('restore button is visible when dashboards are selected', () => {
    mockUseActionSelectionState.mockReturnValue({
      dashboard: { 'dashboard-1': true },
      folder: {},
    });

    render(<RecentlyDeletedActions />);

    expect(screen.getByRole('button', { name: 'Restore' })).toBeInTheDocument();
  });
});
