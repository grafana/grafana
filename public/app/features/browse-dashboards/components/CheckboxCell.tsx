import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Checkbox, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { ManagerKind } from '../../apiserver/types';
import { DashboardsTreeCellProps, SelectionState } from '../types';

import { isSharedWithMe } from './utils';

export default function CheckboxCell({
  row: { original: row },
  isSelected,
  onItemSelectionChange,
}: DashboardsTreeCellProps) {
  const item = row.item;

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

  const state = isSelected(item);

  return (
    <Checkbox
      data-testid={selectors.pages.BrowseDashboards.table.checkbox(item.uid)}
      aria-label={t('browse-dashboards.dashboards-tree.select-checkbox', 'Select')}
      value={state === SelectionState.Selected}
      indeterminate={state === SelectionState.Mixed}
      onChange={(ev) => onItemSelectionChange?.(item, ev.currentTarget.checked)}
      disabled={item.managedBy === ManagerKind.Repo}
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
