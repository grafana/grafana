import { render, screen } from 'test/test-utils';

import { selectors } from '@grafana/e2e-selectors';
import { type BulkActionProvisionResourceProps } from 'app/features/provisioning/components/BulkActions/utils';
import { useSelectionProvisioningStatus } from 'app/features/provisioning/hooks/useSelectionProvisioningStatus';

import { mockFolderDTO } from '../../fixtures/folder.fixture';

import { BrowseActions } from './BrowseActions';

jest.mock('app/features/provisioning/hooks/useSelectionProvisioningStatus', () => ({
  useSelectionProvisioningStatus: jest.fn(),
}));

// The drawer body is covered by its own tests; here it only needs to report the two events
// BrowseActions reacts to and show which selection it was given.
jest.mock('app/features/provisioning/components/BulkActions/BulkDeleteProvisionedResource', () => ({
  BulkDeleteProvisionedResource: ({
    selectedItems,
    folderUid,
    onDismiss,
    onJobCreated,
  }: BulkActionProvisionResourceProps) => (
    <>
      <span>
        {Object.values(selectedItems.dashboard).filter(Boolean).length} selected in {folderUid}
      </span>
      <button onClick={onJobCreated}>Create job</button>
      <button onClick={onDismiss}>Cancel</button>
    </>
  ),
}));

const mockUseSelectionProvisioningStatus = jest.mocked(useSelectionProvisioningStatus);

function setup(selected = true, folderDTO = mockFolderDTO(1, { uid: 'folder-a' })) {
  return render(<BrowseActions folderDTO={folderDTO} />, {
    preloadedState: {
      browseDashboards: {
        rootItems: undefined,
        childrenByParentUID: {},
        openFolders: {},
        selectedItems: { $all: false, folder: {}, dashboard: { 'dash-1': selected }, panel: {} },
      },
    },
  });
}

describe('browse-dashboards BrowseActions', () => {
  beforeEach(() => {
    mockUseSelectionProvisioningStatus.mockReturnValue({ hasProvisioned: false, hasNonProvisioned: true });
  });

  it('displays Move and Delete buttons', () => {
    setup();

    expect(screen.getByRole('button', { name: 'Move' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('shows no actions without a selection', () => {
    setup(false);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  describe('provisioned bulk drawer', () => {
    beforeEach(() => {
      mockUseSelectionProvisioningStatus.mockReturnValue({ hasProvisioned: true, hasNonProvisioned: false });
    });

    it('keeps the selection when cancelled before a job exists', async () => {
      const { user, store } = setup();

      await user.click(screen.getByRole('button', { name: 'Delete' }));
      await user.click(await screen.findByRole('button', { name: 'Cancel' }));

      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
      expect(store!.getState().browseDashboards.selectedItems.dashboard['dash-1']).toBe(true);
    });

    it('clears the selection once a job exists; the drawer keeps the selection and folder it was opened with', async () => {
      const { user, store, rerender } = setup();

      await user.click(screen.getByRole('button', { name: 'Delete' }));
      // The page navigates (browser back) while the drawer is open.
      rerender(<BrowseActions folderDTO={mockFolderDTO(2, { uid: 'folder-b' })} />);
      await user.click(await screen.findByRole('button', { name: 'Create job' }));

      expect(store!.getState().browseDashboards.selectedItems.dashboard['dash-1']).toBe(false);
      expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
      expect(screen.getByText('1 selected in folder-a')).toBeInTheDocument();

      await user.click(screen.getByTestId(selectors.components.Drawer.General.close));
      expect(screen.queryByText('1 selected in folder-a')).not.toBeInTheDocument();
    });
  });
});
