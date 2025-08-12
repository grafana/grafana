import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { Checkbox, Tooltip, useStyles2 } from '@grafana/ui';
import { ManagerKind } from 'app/features/apiserver/types';
import { DashboardViewItem } from 'app/features/search/types';
import { useSelector } from 'app/types/store';

import { DashboardsTreeCellProps, SelectionState, DashboardViewItemWithUIItems } from '../types';

import { useSelectionRepoValidation } from './BrowseActions/useSelectionRepoValidation';
import { isSharedWithMe, canEditItemType } from './utils';

export default function CheckboxCell({
  row: { original: row },
  isSelected,
  onItemSelectionChange,
  permissions,
}: DashboardsTreeCellProps) {
  const item = row.item;

  // Get current selection state for repository validation
  const selectedItems = useSelector((state) => state.browseDashboards.selectedItems);
  const { selectedItemsRepoUID, isInLockedRepo } = useSelectionRepoValidation(selectedItems);

  // Type guard to check if item is a DashboardViewItem (not UI item)
  const isDashboardViewItem = (item: DashboardViewItemWithUIItems): item is DashboardViewItem => {
    return item.kind !== 'ui';
  };

  // Early returns for cases where we should show a spacer instead of checkbox
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

  // Disable checkbox for root provisioned folder itself
  if (isDashboardViewItem(item) && item.managedBy === ManagerKind.Repo && !item.parentUID) {
    return <CheckboxSpacer />;
  }

  // Check if user can edit this specific item type
  if (permissions && !canEditItemType(item.kind, permissions)) {
    return <CheckboxSpacer />;
  }

  if (isDashboardViewItem(item) && selectedItemsRepoUID && !isInLockedRepo(item.uid)) {
    return (
      <Tooltip
        content={t(
          'browse-dashboards.dashboards-tree.checkbox.disabled-not-in-same-repo',
          'This item is not in the same repository as the selected items.'
        )}
      >
        <span>
          <Checkbox disabled value={false} />
        </span>
      </Tooltip>
    );
  }

  // At this point we know it's a valid item to show a checkbox for
  if (!isDashboardViewItem(item)) {
    return <CheckboxSpacer />;
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
