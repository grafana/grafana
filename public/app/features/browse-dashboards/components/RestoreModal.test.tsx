import { skipToken } from '@reduxjs/toolkit/query';
import type { ComponentProps, ReactNode } from 'react';
import { render, screen } from 'test/test-utils';

import { deletedFoldersState } from 'app/features/search/service/deletedFoldersState';

import { useGetFolderQuery } from '../api/browseDashboardsAPI';

import { RestoreModal } from './RestoreModal';

jest.mock('@grafana/ui', () => {
  const actual = jest.requireActual('@grafana/ui');
  type MockConfirmModalProps = {
    body?: ReactNode;
    confirmText?: ReactNode;
    disabled?: boolean;
    isOpen?: boolean;
    onConfirm?: () => void;
    onDismiss?: () => void;
    title?: ReactNode;
  };

  return {
    ...actual,
    ConfirmModal: ({ body, confirmText, disabled, isOpen, onConfirm, onDismiss, title }: MockConfirmModalProps) =>
      isOpen ? (
        <div>
          <div>{title}</div>
          <div>{body}</div>
          <button onClick={onConfirm} disabled={disabled}>
            {confirmText}
          </button>
          <button onClick={onDismiss}>Dismiss</button>
        </div>
      ) : null,
  };
});

jest.mock('../api/browseDashboardsAPI', () => ({
  ...jest.requireActual('../api/browseDashboardsAPI'),
  useGetFolderQuery: jest.fn(),
}));

jest.mock('../../../core/components/Select/FolderPicker', () => ({
  FolderPicker: ({ onChange, value }: { onChange?: (folderUID: string | undefined) => void; value?: string }) => (
    <div>
      <div data-testid="folder-picker-value">{value === undefined ? 'undefined' : value === '' ? 'root' : value}</div>
      <button onClick={() => onChange?.('manual-folder')}>Pick manual folder</button>
      <button onClick={() => onChange?.(undefined)}>Clear folder</button>
    </div>
  ),
}));

const mockUseGetFolderQuery = useGetFolderQuery as jest.MockedFunction<typeof useGetFolderQuery>;
const onConfirm = jest.fn().mockResolvedValue(undefined);
const onDismiss = jest.fn();

type FolderQueryState = {
  data?: { uid: string };
  error?: unknown;
  isError: boolean;
  isFetching: boolean;
  isSuccess: boolean;
  refetch: jest.Mock;
};

describe('RestoreModal', () => {
  let folderQueryState: FolderQueryState;

  beforeEach(() => {
    jest.clearAllMocks();
    deletedFoldersState.clear();
    folderQueryState = buildFolderQueryState();
    mockUseGetFolderQuery.mockImplementation(() => folderQueryState);
  });

  it('preselects the root folder immediately without validating it', () => {
    renderRestoreModal({ originCandidate: '' });

    expect(screen.getByTestId('folder-picker-value')).toHaveTextContent('root');
    expect(screen.getByRole('button', { name: 'Restore' })).toBeEnabled();
  });

  it('preselects a live origin folder after a successful validation lookup', () => {
    folderQueryState = buildFolderQueryState({ isSuccess: true, isFetching: false });

    renderRestoreModal({ originCandidate: 'folder-1' });

    expect(screen.getByTestId('folder-picker-value')).toHaveTextContent('folder-1');
    expect(screen.getByRole('button', { name: 'Restore' })).toBeEnabled();
  });

  it('skips validation and leaves the picker empty when the origin folder was deleted in this session', () => {
    deletedFoldersState.markDeleted('folder-1');

    renderRestoreModal({ originCandidate: 'folder-1' });

    expect(mockUseGetFolderQuery).toHaveBeenCalledWith(skipToken, { refetchOnMountOrArgChange: true });
    expect(screen.getByTestId('folder-picker-value')).toHaveTextContent('undefined');
    expect(screen.getByRole('button', { name: 'Restore' })).toBeDisabled();
  });

  it('leaves the picker empty when the refetch returns 404 even if stale data exists', () => {
    folderQueryState = buildFolderQueryState({
      data: { uid: 'folder-1' },
      error: { status: 404, data: { message: 'Folder not found' } },
      isError: true,
      isSuccess: false,
      isFetching: false,
    });

    renderRestoreModal({ originCandidate: 'folder-1' });

    expect(screen.getByTestId('folder-picker-value')).toHaveTextContent('undefined');
    expect(screen.getByRole('button', { name: 'Restore' })).toBeDisabled();
  });

  it('keeps the original folder selected when validation returns 403', () => {
    folderQueryState = buildFolderQueryState({
      error: { status: 403, data: { message: 'Forbidden' } },
      isError: true,
      isSuccess: false,
      isFetching: false,
    });

    renderRestoreModal({ originCandidate: 'folder-1' });

    expect(screen.getByTestId('folder-picker-value')).toHaveTextContent('folder-1');
    expect(screen.getByRole('button', { name: 'Restore' })).toBeEnabled();
  });

  it('does not preselect while a refetch is in progress, even if stale data exists', () => {
    folderQueryState = buildFolderQueryState({
      data: { uid: 'folder-1' },
      isSuccess: true,
      isFetching: true,
    });

    renderRestoreModal({ originCandidate: 'folder-1' });

    expect(screen.getByTestId('folder-picker-value')).toHaveTextContent('undefined');
    expect(screen.getByRole('button', { name: 'Restore' })).toBeDisabled();
  });

  it('preserves a manual folder selection when validation later succeeds', async () => {
    folderQueryState = buildFolderQueryState({ isSuccess: false, isFetching: true });
    const { rerender, user } = renderRestoreModal({ originCandidate: 'folder-1' });

    await user.click(screen.getByRole('button', { name: 'Pick manual folder' }));
    expect(screen.getByTestId('folder-picker-value')).toHaveTextContent('manual-folder');

    folderQueryState = buildFolderQueryState({ isSuccess: true, isFetching: false });
    rerender(
      <RestoreModal
        onConfirm={onConfirm}
        onDismiss={onDismiss}
        selectedDashboards={['dashboard-1']}
        isLoading={false}
        originCandidate="folder-1"
      />
    );

    expect(screen.getByTestId('folder-picker-value')).toHaveTextContent('manual-folder');
    expect(screen.getByRole('button', { name: 'Restore' })).toBeEnabled();
  });
});

function renderRestoreModal(props: Partial<ComponentProps<typeof RestoreModal>> = {}) {
  return render(
    <RestoreModal
      onConfirm={onConfirm}
      onDismiss={onDismiss}
      selectedDashboards={['dashboard-1']}
      isLoading={false}
      {...props}
    />
  );
}

function buildFolderQueryState(overrides: Partial<FolderQueryState> = {}): FolderQueryState {
  return {
    data: undefined,
    error: undefined,
    isError: false,
    isFetching: false,
    isSuccess: false,
    refetch: jest.fn(),
    ...overrides,
  };
}
