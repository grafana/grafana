import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { Checkbox, useStyles2 } from '@grafana/ui';
import { ManagerKind } from 'app/features/apiserver/types';
import { useSelector } from 'app/types/store';

import { useChildrenByParentUIDState, rootItemsSelector } from '../state/hooks';
import { findItem } from '../state/utils';
import { DashboardsTreeCellProps, SelectionState } from '../types';

import { useRepositoryValidation } from './BrowseActions/useRepositoryValidation';
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
  const { allFromSameRepo, commonRepository, hasSelection } = useRepositoryValidation(selectedItems);

  // Get browse state for repository detection
  const childrenByParentUID = useChildrenByParentUIDState();
  const rootItems = useSelector(rootItemsSelector);

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
  const isRootProvisionedFolder = item.managedBy === ManagerKind.Repo && !item.parentUID;
  if (isRootProvisionedFolder) {
    return <CheckboxSpacer />;
  }

  // Check if user can edit this specific item type
  if (permissions && !canEditItemType(item.kind, permissions)) {
    return <CheckboxSpacer />;
  }

  // Check if this item conflicts with existing selection
  let shouldDisable = false;
  if (hasSelection && !allFromSameRepo) {
    // If there's already a mixed selection, disable everything except already selected items
    const currentState = isSelected(item);
    shouldDisable = currentState === SelectionState.Unselected;
  } else if (hasSelection && commonRepository) {
    // If there's a repository selection, check if this item matches
    const getItemRepository = (): string | null => {
      // Root provisioned folder - UID is the repository name
      if (item.managedBy === ManagerKind.Repo && !item.parentUID && item.kind === 'folder') {
        return item.uid;
      }

      // For nested items, traverse up to find root provisioned folder
      if (item.parentUID) {
        let currentUID: string | undefined = item.parentUID;
        while (currentUID) {
          const parent = findItem(rootItems?.items || [], childrenByParentUID, currentUID);
          if (!parent) {
            break;
          }

          if (parent.managedBy === ManagerKind.Repo && !parent.parentUID) {
            return currentUID; // Found root provisioned folder
          }
          currentUID = parent.parentUID;
        }
      }

      return null; // Non-provisioned item
    };

    const itemRepository = getItemRepository();
    shouldDisable = itemRepository !== commonRepository;

    // Debug log for UX demonstration
    if (shouldDisable) {
      console.log('Checkbox disabled:', {
        itemUid: item.uid,
        itemRepository,
        commonRepository,
        reason: 'Repository mismatch',
      });
    }
  }

  const state = isSelected(item);

  return (
    <Checkbox
      data-testid={selectors.pages.BrowseDashboards.table.checkbox(item.uid)}
      aria-label={t('browse-dashboards.dashboards-tree.select-checkbox', 'Select')}
      value={state === SelectionState.Selected}
      indeterminate={state === SelectionState.Mixed}
      disabled={shouldDisable}
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
