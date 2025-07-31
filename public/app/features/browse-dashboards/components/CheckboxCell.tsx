import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { Checkbox, Tooltip, useStyles2 } from '@grafana/ui';
import { ManagerKind } from 'app/features/apiserver/types';
import { useSelector } from 'app/types/store';

import { DashboardsTreeCellProps, SelectionState } from '../types';

import { useSelectionProvisioningStatus } from './BrowseActions/useSelectionProvisioningStatus';
import { isSharedWithMe, canEditItemType } from './utils';

export default function CheckboxCell({
  row: { original: row },
  isSelected,
  onItemSelectionChange,
  permissions,
}: DashboardsTreeCellProps) {
  const item = row.item;

  // Get current selection state to check for root folder conflicts
  const selectedItems = useSelector((state) => state.browseDashboards.selectedItems);
  const { firstSelectedRootFolder, getItemRootFolder } = useSelectionProvisioningStatus(
    selectedItems,
    false // We don't need parent provisioned check for checkbox logic
  );

  if (!isSelected) {
    return <CheckboxSpacer />;
  }

  if (item.kind === 'ui') {
    if (item.uiKind === 'pagination-placeholder') {
      return <Checkbox disabled value={false} />;
    } else {
      return <CheckboxSpacer />;
    }
  }

  if (isSharedWithMe(item.uid)) {
    return <CheckboxSpacer />;
  }

  // we don't want to select root provisioned folder
  const isRootProvisionedFolder = item.managedBy === ManagerKind.Repo && !item.parentUID;
  if (isRootProvisionedFolder) {
    return <CheckboxSpacer />;
  }

  // Check if user can edit this specific item type
  if (permissions && !canEditItemType(item.kind, permissions)) {
    return <CheckboxSpacer />;
  }

  // Check if this item is from a different root folder than already selected items
  const itemRootFolder = getItemRootFolder(item);
  const isFromDifferentRootFolder =
    firstSelectedRootFolder && itemRootFolder && itemRootFolder !== firstSelectedRootFolder;

  if (isFromDifferentRootFolder) {
    return (
      <Tooltip
        content={t(
          'browse-dashboards.different-folder-disabled',
          'Items from another folder are already selected. Cannot mix folders in bulk actions.'
        )}
      >
        <Checkbox disabled value={false} />
      </Tooltip>
    );
  }

  const state = isSelected(item);

  return (
    <Checkbox
      data-testid={selectors.pages.BrowseDashboards.table.checkbox(item.uid)}
      aria-label={t('browse-dashboards.dashboards-tree.select-checkbox', 'Select')}
      value={state === SelectionState.Selected}
      indeterminate={state === SelectionState.Mixed}
      onChange={(ev) => onItemSelectionChange?.(item, ev.currentTarget.checked)}
    />
  );
}

function CheckboxSpacer() {
  const styles = useStyles2(getStyles);
  return <span className={styles.checkboxSpacer} />;
}

const getStyles = (theme: GrafanaTheme2) => ({
  // Should be the same size as the <IconButton /> so Dashboard name is aligned to Folder name siblings
  checkboxSpacer: css({
    paddingLeft: theme.spacing(2),
  }),
});
