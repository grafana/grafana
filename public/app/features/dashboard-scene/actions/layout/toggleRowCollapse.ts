import { t } from '@grafana/i18n';

import { type RowItem } from '../../scene/layout-rows/RowItem';
import { getDashboardSceneFor } from '../../utils/utils';
import { edit } from '../utils/edit';

export function toggleRowCollapse(row: RowItem) {
  const { collapse } = row.state;
  const isCollapsing = !collapse;

  edit({
    meta: { actionId: isCollapsing ? 'row.collapse' : 'row.expand' },
    description: isCollapsing
      ? t('dashboard.edit-actions.collapse-row', 'Collapse row')
      : t('dashboard.edit-actions.expand-row', 'Expand row'),
    // Collapse is local to this row; notifying repeaters would rebuild clones with its collapsed state.
    source: getDashboardSceneFor(row),
    perform: () => row.setCollapsedState(isCollapsing),
    undo: () => row.setState({ collapse }),
  });
}
