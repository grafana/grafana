import { t } from '@grafana/i18n';

import { type DashboardScene } from '../../scene/DashboardScene';
import { type RowItem } from '../../scene/layout-rows/RowItem';
import { endBatch, startBatch } from '../utils/batch';
import { edit } from '../utils/edit';

interface ChangeRowsHeaderVisibilityActionProps {
  dashboard: DashboardScene;
  rows: RowItem[];
  hideHeader: boolean;
}

export function changeRowsHeaderVisibility({ dashboard, rows, hideHeader }: ChangeRowsHeaderVisibilityActionProps) {
  startBatch(
    dashboard,
    hideHeader
      ? t('dashboard.edit-actions.rows-hide-header', 'Hide row headers')
      : t('dashboard.edit-actions.rows-show-header', 'Show row headers'),
    { actionId: 'row.changeHeaderVisibility', scope: 'multiple' }
  );

  try {
    // One action per row with the row as source, so repeated rows are rebuilt with the new header visibility
    rows.forEach((row) => {
      const { hideHeader: previous } = row.state;

      edit({
        meta: { actionId: 'row.changeHeaderVisibility' },
        source: row,
        perform: () => row.onHeaderHiddenToggle(hideHeader),
        undo: () => row.setState({ hideHeader: previous }),
      });
    });
  } finally {
    endBatch(dashboard);
  }
}
