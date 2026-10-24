import { render, screen } from 'test/test-utils';

import { selectors } from '@grafana/e2e-selectors';
import { type BulkActionProvisionResourceProps } from 'app/features/provisioning/components/BulkActions/utils';
import { useSelectionProvisioningStatus } from 'app/features/provisioning/hooks/useSelectionProvisioningStatus';

import { BrowseActions } from './BrowseActions';

jest.mock('app/features/provisioning/hooks/useSelectionProvisioningStatus', () => ({
  useSelectionProvisioningStatus: jest.fn(),
}));

// The drawer body is covered by its own tests; here it only needs to report the two
// events BrowseActions reacts to.
jest.mock('app/features/provisioning/components/BulkActions/BulkDeleteProvisionedResource', () => ({
  BulkDeleteProvisionedResource: ({ onDismiss, onJobCreated }: BulkActionProvisionResourceProps) => (
    <>
      <button onClick={onJobCreated}>Create job</button>
      <button onClick={onDismiss}>Cancel</button>
    </>
  ),
}));

const mockUseSelectionProvisioningStatus = jest.mocked(useSelectionProvisioningStatus);

function setup() {
  return render(<BrowseActions />, {
    preloadedState: {
      browseDashboards: {
        rootItems: undefined,
        childrenByParentUID: {},
        openFolders: {},
        selectedItems: { $all: false, folder: {}, dashboard: { 'dash-1': true }, panel: {} },
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

    it('clears the selection when closed after a job was created', async () => {
      const { user, store } = setup();

      await user.click(screen.getByRole('button', { name: 'Delete' }));
      await user.click(await screen.findByRole('button', { name: 'Create job' }));
      await user.click(screen.getByTestId(selectors.components.Drawer.General.close));

      expect(store!.getState().browseDashboards.selectedItems.dashboard['dash-1']).toBe(false);
    });
  });
});
