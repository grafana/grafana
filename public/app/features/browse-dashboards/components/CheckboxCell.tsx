import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { Checkbox, Tooltip, useStyles2 } from '@grafana/ui';
import { ManagerKind } from 'app/features/apiserver/types';
import { useIsProvisionedInstance } from 'app/features/provisioning/hooks/useIsProvisionedInstance';
import { useSelectionRepoValidation } from 'app/features/provisioning/hooks/useSelectionRepoValidation';
import { getReadOnlyTooltipText } from 'app/features/provisioning/utils/repository';
import { useSelector } from 'app/types/store';

import { DashboardsTreeCellProps, SelectionState } from '../types';

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
  const { selectedItemsRepoUID, isInLockedRepo, isUidInReadOnlyRepo } = useSelectionRepoValidation(selectedItems);
  const isProvisionedInstance = useIsProvisionedInstance();

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

  // Disable the checkbox for the root provisioned folder (if the entire instance is not provisioned)
  if (!isProvisionedInstance && item.managedBy === ManagerKind.Repo && !item.parentUID) {
    return <CheckboxSpacer />;
  }

  if ((permissions && permissions.isReadOnlyRepo) || isUidInReadOnlyRepo(item.uid)) {
    // When the folder is read-only (inherited from repository), disable checkbox with tooltip
    return (
      <Tooltip content={getReadOnlyTooltipText({})}>
        <span>
          <Checkbox disabled value={false} />
        </span>
      </Tooltip>
    );
  }

  // Check if user can edit this specific item type
  if (permissions && !canEditItemType(item.kind, permissions)) {
    return <CheckboxSpacer />;
  }

  // check if current item uid has different repo uid than selected items
  if (selectedItemsRepoUID && !isInLockedRepo(item.uid)) {
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
