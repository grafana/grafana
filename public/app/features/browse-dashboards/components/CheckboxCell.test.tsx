import { render, screen } from 'test/test-utils';

import { selectors } from '@grafana/e2e-selectors';
import { config } from '@grafana/runtime';
import { getFolderFixtures } from '@grafana/test-utils/unstable';
import { ManagerKind } from 'app/features/apiserver/types';
import {
  DashboardsTreeCellProps,
  DashboardsTreeItem,
  DashboardViewItemWithUIItems,
  SelectionState,
} from 'app/features/browse-dashboards/types';
import { useIsProvisionedInstance } from 'app/features/provisioning/hooks/useIsProvisionedInstance';
import { useSelectionRepoValidation } from 'app/features/provisioning/hooks/useSelectionRepoValidation';
import { DashboardViewItem } from 'app/features/search/types';
import { RootState } from 'app/store/configureStore';
import { useSelector } from 'app/types/store';

import CheckboxCell from './CheckboxCell';

jest.mock('app/types/store', () => {
  const original = jest.requireActual('app/types/store');
  return {
    ...original,
    useSelector: jest.fn(),
  };
});

jest.mock('app/features/provisioning/hooks/useSelectionRepoValidation', () => ({
  useSelectionRepoValidation: jest.fn(),
}));

jest.mock('app/features/provisioning/hooks/useIsProvisionedInstance', () => ({
  useIsProvisionedInstance: jest.fn(),
}));

const mockUseSelectionRepoValidation = useSelectionRepoValidation as jest.MockedFunction<
  typeof useSelectionRepoValidation
>;
const mockUseIsProvisionedInstance = useIsProvisionedInstance as jest.MockedFunction<typeof useIsProvisionedInstance>;
const mockUseSelector = useSelector as jest.MockedFunction<typeof useSelector>;

const defaultPermissions = {
  canEditFolders: true,
  canEditDashboards: true,
  canDeleteFolders: true,
  canDeleteDashboards: true,
};

const baseSelectedItems = {
  $all: false,
  dashboard: {},
  folder: {},
  panel: {},
};

const [_, fixtures] = getFolderFixtures();
const sharedWithMeUid = 'sharedwithme';
const dashboardItem = fixtures.dashbdD;
const folderItem = fixtures.folderA;

function mockSelectedItems() {
  mockUseSelector.mockImplementation((selector) => {
    const state = {
      browseDashboards: { selectedItems: baseSelectedItems },
    } as unknown as RootState;
    return selector(state);
  });
}

function setup(
  item: DashboardsTreeItem<DashboardViewItemWithUIItems> = dashboardItem,
  overrides?: {
    isSelected?: (item: DashboardViewItem | '$all') => SelectionState;
    permissions?: DashboardsTreeCellProps['permissions'];
    onItemSelectionChange?: DashboardsTreeCellProps['onItemSelectionChange'];
    includeIsSelected?: boolean;
  }
) {
  const isSelected = overrides?.isSelected ?? (() => SelectionState.Unselected);
  const onItemSelectionChange = overrides?.onItemSelectionChange;
  const permissions = overrides?.permissions ?? defaultPermissions;
  const includeIsSelected = overrides?.includeIsSelected ?? true;

  const props: Partial<DashboardsTreeCellProps> = {
    row: { original: item } as DashboardsTreeCellProps['row'],
    onItemSelectionChange,
    permissions,
  };
  if (includeIsSelected) {
    props.isSelected = isSelected;
  }

  return render(<CheckboxCell {...(props as DashboardsTreeCellProps)} />);
}

describe('CheckboxCell', () => {
  beforeEach(() => {
    config.sharedWithMeFolderUID = sharedWithMeUid;
    mockSelectedItems();
    mockUseIsProvisionedInstance.mockReturnValue(false);
    mockUseSelectionRepoValidation.mockReturnValue({
      selectedItemsRepoUID: undefined,
      isInLockedRepo: () => true,
      isCrossRepo: false,
      isUidInReadOnlyRepo: () => false,
    });
  });

  it('renders a selectable checkbox and calls onItemSelectionChange', async () => {
    const item = { ...dashboardItem, item: { ...dashboardItem.item, uid: 'dash-1' } };
    const onItemSelectionChange = jest.fn();

    const { user } = setup(item, {
      isSelected: () => SelectionState.Unselected,
      onItemSelectionChange,
    });

    const checkbox = screen.getByTestId(selectors.pages.BrowseDashboards.table.checkbox(item.item.uid));
    expect(checkbox).toBeInTheDocument();

    await user.click(checkbox);
    expect(onItemSelectionChange).toHaveBeenCalledWith(item.item, true);
  });

  it('renders a checked checkbox when item is selected', () => {
    const item = { ...dashboardItem, item: { ...dashboardItem.item, uid: 'dash-selected' } };

    setup(item, {
      isSelected: () => SelectionState.Selected,
    });

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked();
  });

  it('renders a mixed checkbox when item selection is mixed', () => {
    const item = { ...dashboardItem, item: { ...dashboardItem.item, uid: 'dash-mixed' } };

    setup(item, {
      isSelected: () => SelectionState.Mixed,
    });

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBePartiallyChecked();
  });

  it('renders a spacer when isSelected function is not provided', () => {
    setup(dashboardItem, { includeIsSelected: false });

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('renders a disabled checkbox for pagination placeholder ui items', () => {
    const item: DashboardsTreeItem<DashboardViewItemWithUIItems> = {
      item: {
        kind: 'ui',
        uiKind: 'pagination-placeholder',
        uid: 'ui-pagination',
      },
      level: 0,
      isOpen: false,
    };

    setup(item);

    expect(screen.getByRole('checkbox')).toBeDisabled();
  });

  it('renders a spacer for non-pagination ui items', () => {
    const item: DashboardsTreeItem<DashboardViewItemWithUIItems> = {
      item: {
        kind: 'ui',
        uiKind: 'divider',
        uid: 'ui-divider',
      },
      level: 0,
      isOpen: false,
    };

    setup(item);

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('renders a spacer when item is shared with me', () => {
    const item = {
      ...folderItem,
      item: { ...folderItem.item, uid: sharedWithMeUid, url: undefined },
    };
    setup(item, { isSelected: () => SelectionState.Unselected });

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('renders a disabled checkbox for read-only repo items', () => {
    // Read-only derived from permissions on the item.
    const item = { ...dashboardItem, item: { ...dashboardItem.item, uid: 'dash-readonly' } };
    setup(item, {
      permissions: {
        ...defaultPermissions,
        isReadOnlyRepo: true,
      },
    });

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeDisabled();
  });

  it('renders a disabled checkbox when the item uid is in a read-only repo', () => {
    // Read-only derived from the repository validation hook.
    const item = { ...dashboardItem, item: { ...dashboardItem.item, uid: 'dash-uid-readonly' } };
    mockUseSelectionRepoValidation.mockReturnValue({
      selectedItemsRepoUID: undefined,
      isInLockedRepo: () => true,
      isCrossRepo: false,
      isUidInReadOnlyRepo: () => true,
    });

    setup(item);

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeDisabled();
  });

  it('renders a spacer when user cannot edit the item type', () => {
    const item = { ...dashboardItem, item: { ...dashboardItem.item, uid: 'dash-no-perms' } };
    setup(item, {
      permissions: {
        ...defaultPermissions,
        canEditDashboards: false,
        canDeleteDashboards: false,
      },
    });

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('renders a disabled checkbox when item is not in the same repo', () => {
    const item = { ...dashboardItem, item: { ...dashboardItem.item, uid: 'dash-other-repo' } };
    mockUseSelectionRepoValidation.mockReturnValue({
      selectedItemsRepoUID: 'repo-a',
      isInLockedRepo: () => false,
      isCrossRepo: false,
      isUidInReadOnlyRepo: () => false,
    });
    setup(item);

    expect(
      screen.queryByTestId(selectors.pages.BrowseDashboards.table.checkbox(item.item.uid))
    ).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeDisabled();
  });

  it('renders a spacer for root provisioned folders when instance is not provisioned ', () => {
    const item = {
      ...folderItem,
      item: { ...folderItem.item, managedBy: ManagerKind.Repo, parentUID: undefined },
    };
    setup(item);

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('renders a checkbox for root provisioned folders when whole instance is provisioned', () => {
    mockUseIsProvisionedInstance.mockReturnValue(true);

    const item = {
      ...folderItem,
      item: { ...folderItem.item, managedBy: ManagerKind.Repo, parentUID: undefined, uid: 'root-provisioned' },
    };

    setup(item);
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });
});
