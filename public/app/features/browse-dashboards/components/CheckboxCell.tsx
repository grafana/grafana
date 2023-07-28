import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Checkbox, useStyles2 } from '@grafana/ui';

import { DashboardsTreeCellProps, SelectionState } from '../types';

export default function CheckboxCell({
  row: { original: row },
  isSelected,
  onItemSelectionChange,
}: DashboardsTreeCellProps) {
  const styles = useStyles2(getStyles);
  const item = row.item;

  if (!isSelected) {
    return <span className={styles.checkboxSpacer} />;
  }

  if (item.kind === 'ui') {
    if (item.uiKind === 'pagination-placeholder') {
      return <Checkbox disabled value={false} />;
    } else {
      return <span className={styles.checkboxSpacer} />;
    }
  }

  const state = isSelected(item);

  return (
    <Checkbox
      data-testid={selectors.pages.BrowseDashbards.table.checkbox(item.uid)}
      value={state === SelectionState.Selected}
      indeterminate={state === SelectionState.Mixed}
      onChange={(ev) => onItemSelectionChange?.(item, ev.currentTarget.checked)}
    />
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  // Should be the same size as the <IconButton /> so Dashboard name is aligned to Folder name siblings
  checkboxSpacer: css({
    paddingLeft: theme.spacing(2),
  }),
});
