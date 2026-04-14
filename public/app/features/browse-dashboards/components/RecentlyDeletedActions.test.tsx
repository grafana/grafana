import type { ComponentProps } from 'react';
import { render, screen } from 'test/test-utils';

import { DataFrameView, FieldType, toDataFrame } from '@grafana/data';
import { setBackendSrv } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';

import { deletedDashboardsCache } from '../../search/service/deletedDashboardsCache';
import { type DashboardQueryResult } from '../../search/service/types';
import { SearchLayout, type EventTrackingNamespace } from '../../search/types';
import { type TrashStateManager, useRecentlyDeletedStateManager } from '../api/useRecentlyDeletedStateManager';
import { useActionSelectionState } from '../state/hooks';

import { RecentlyDeletedActions } from './RecentlyDeletedActions';
import { RestoreModal } from './RestoreModal';

jest.mock('../api/useRecentlyDeletedStateManager');
jest.mock('../state/hooks');
jest.mock('../../search/service/deletedDashboardsCache');
jest.mock('./RestoreModal', () => ({
  RestoreModal: jest.fn(() => null),
}));

setBackendSrv(backendSrv);
setupMockServer();

const mockUseRecentlyDeletedStateManager = useRecentlyDeletedStateManager as jest.MockedFunction<
  typeof useRecentlyDeletedStateManager
>;
const mockUseActionSelectionState = useActionSelectionState as jest.MockedFunction<typeof useActionSelectionState>;
const mockRestoreModal = RestoreModal as jest.MockedFunction<typeof RestoreModal>;

describe('RecentlyDeletedActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setRecentlyDeletedState({
      uids: ['dashboard-1'],
      locations: ['folder-1'],
    });
    mockUseActionSelectionState.mockReturnValue({
      dashboard: {},
      folder: {},
    });

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

  it('passes a common folder origin as the restore modal candidate', async () => {
    setRecentlyDeletedState({
      uids: ['dashboard-1', 'dashboard-2'],
      locations: ['folder-1', 'folder-1'],
    });
    mockUseActionSelectionState.mockReturnValue({
      dashboard: { 'dashboard-1': true, 'dashboard-2': true },
      folder: {},
    });

    const { user } = render(<RecentlyDeletedActions />);
    await user.click(screen.getByRole('button', { name: 'Restore' }));

    expect(getRestoreModalProps().originCandidate).toBe('folder-1');
  });

  it('maps the general folder to the root restore target', async () => {
    setRecentlyDeletedState({
      uids: ['dashboard-1'],
      locations: ['general'],
    });
    mockUseActionSelectionState.mockReturnValue({
      dashboard: { 'dashboard-1': true },
      folder: {},
    });

    const { user } = render(<RecentlyDeletedActions />);
    await user.click(screen.getByRole('button', { name: 'Restore' }));

    expect(getRestoreModalProps().originCandidate).toBe('');
  });

  it('does not preselect a folder when selected dashboards have mixed origins', async () => {
    setRecentlyDeletedState({
      uids: ['dashboard-1', 'dashboard-2'],
      locations: ['folder-1', 'folder-2'],
    });
    mockUseActionSelectionState.mockReturnValue({
      dashboard: { 'dashboard-1': true, 'dashboard-2': true },
      folder: {},
    });

    const { user } = render(<RecentlyDeletedActions />);
    await user.click(screen.getByRole('button', { name: 'Restore' }));

    expect(getRestoreModalProps().originCandidate).toBeUndefined();
  });
});

function setRecentlyDeletedState({ uids, locations }: { uids: string[]; locations: string[] }) {
  const mockDataFrame = toDataFrame({
    name: 'DeletedDashboards',
    fields: [
      { name: 'kind', type: FieldType.string, config: {}, values: uids.map(() => 'dashboard') },
      { name: 'name', type: FieldType.string, config: {}, values: uids.map((uid) => `Title ${uid}`) },
      { name: 'uid', type: FieldType.string, config: {}, values: uids },
      { name: 'url', type: FieldType.string, config: {}, values: uids.map((uid) => `/d/${uid}`) },
      { name: 'panel_type', type: FieldType.string, config: {}, values: uids.map(() => '') },
      { name: 'tags', type: FieldType.other, config: {}, values: uids.map(() => []) },
      { name: 'location', type: FieldType.string, config: {}, values: locations },
      { name: 'ds_uid', type: FieldType.other, config: {}, values: uids.map(() => []) },
      { name: 'score', type: FieldType.number, config: {}, values: uids.map(() => 0) },
      { name: 'explain', type: FieldType.other, config: {}, values: uids.map(() => ({})) },
    ],
  });

  const mockView = new DataFrameView<DashboardQueryResult>(mockDataFrame);

  const mockStateManager = {
    doSearchWithDebounce: jest.fn(),
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
        loadMoreItems: function (): Promise<void> {
          return Promise.resolve();
        },
        isItemLoaded: function () {
          return true;
        },
        totalRows: 0,
      },
    },
    mockStateManager,
  ]);
}

function getRestoreModalProps(): Partial<ComponentProps<typeof RestoreModal>> {
  return mockRestoreModal.mock.lastCall?.[0] ?? {};
}
