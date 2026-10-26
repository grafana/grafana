import { act, render, screen } from 'test/test-utils';

import { selectors } from '@grafana/e2e-selectors';
import { type BulkActionProvisionResourceProps } from 'app/features/provisioning/components/BulkActions/utils';
import { useSelectionProvisioningStatus } from 'app/features/provisioning/hooks/useSelectionProvisioningStatus';

import { setAllSelection } from '../../state/slice';

import { BrowseActions } from './BrowseActions';

jest.mock('app/features/provisioning/hooks/useSelectionProvisioningStatus', () => ({
  useSelectionProvisioningStatus: jest.fn(),
}));

// The drawer body is covered by its own tests; here it only needs to report the two events
// BrowseActions reacts to and show which selection it was given.
jest.mock('app/features/provisioning/components/BulkActions/BulkDeleteProvisionedResource', () => ({
  BulkDeleteProvisionedResource: ({ selectedItems, onDismiss, onJobCreated }: BulkActionProvisionResourceProps) => (
    <>
      <span>{Object.values(selectedItems.dashboard).filter(Boolean).length} selected</span>
      <button onClick={onJobCreated}>Create job</button>
      <button onClick={onDismiss}>Cancel</button>
    </>
  ),
}));

const mockUseSelectionProvisioningStatus = jest.mocked(useSelectionProvisioningStatus);

function setup(selected = true) {
  return render(<BrowseActions />, {
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

    it('clears the selection as soon as a job exists and keeps showing the drawer', async () => {
      const { user, store } = setup();

      await user.click(screen.getByRole('button', { name: 'Delete' }));
      await user.click(await screen.findByRole('button', { name: 'Create job' }));

      expect(store!.getState().browseDashboards.selectedItems.dashboard['dash-1']).toBe(false);
      expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
      expect(screen.getByTestId(selectors.components.Drawer.General.close)).toBeInTheDocument();

      await user.click(screen.getByTestId(selectors.components.Drawer.General.close));
      expect(screen.queryByTestId(selectors.components.Drawer.General.close)).not.toBeInTheDocument();
    });

    it('works on the selection it was opened with, even when the live selection clears underneath', async () => {
      const { user, store } = setup();

      await user.click(screen.getByRole('button', { name: 'Delete' }));
      expect(await screen.findByText('1 selected')).toBeInTheDocument();

      // A repository pull refreshing the tree resets the selection.
      act(() => {
        store!.dispatch(setAllSelection({ isSelected: false, folderUID: undefined }));
      });

      expect(screen.getByText('1 selected')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    });
  });
});
