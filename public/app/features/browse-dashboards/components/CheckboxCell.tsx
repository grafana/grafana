import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { Checkbox, useStyles2 } from '@grafana/ui';
import { ManagerKind } from 'app/features/apiserver/types';
import { DashboardViewItem } from 'app/features/search/types';
import { useSelector } from 'app/types/store';

import { useChildrenByParentUIDState, rootItemsSelector } from '../state/hooks';
import { DashboardsTreeCellProps, SelectionState, DashboardViewItemWithUIItems } from '../types';

import { useRepositoryValidation } from './BrowseActions/useRepositoryValidation';
import { isSharedWithMe, canEditItemType, getItemRepository } from './utils';

export default function CheckboxCell({
  row: { original: row },
  isSelected,
  onItemSelectionChange,
  permissions,
}: DashboardsTreeCellProps) {
  const item = row.item;

  // Get current selection state for repository validation
  const selectedItems = useSelector((state) => state.browseDashboards.selectedItems);
  const { allFromSameRepo, commonRepository, hasSelection } = useRepositoryValidation(selectedItems);

  // Get browse state for repository detection
  const childrenByParentUID = useChildrenByParentUIDState();
  const rootItems = useSelector(rootItemsSelector);

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

  // We don't want to select root provisioned folder
  if (isDashboardViewItem(item) && item.managedBy === ManagerKind.Repo && !item.parentUID) {
    return <CheckboxSpacer />;
  }

  // Check if user can edit this specific item type
  if (permissions && !canEditItemType(item.kind, permissions)) {
    return <CheckboxSpacer />;
  }

  const shouldDisableCheckbox = (): boolean => {
    if (!hasSelection) {
      return false;
    }

    // If there's already a mixed selection, disable unselected items
    if (!allFromSameRepo) {
      const currentState = isSelected(item);
      return currentState === SelectionState.Unselected;
    }

    // If there's a repository selection, check if this item matches
    if (commonRepository && isDashboardViewItem(item)) {
      const itemRepository = getItemRepository(item, rootItems?.items || [], childrenByParentUID);
      return itemRepository !== commonRepository;
    }

    return false;
  };

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
      disabled={shouldDisableCheckbox()}
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
