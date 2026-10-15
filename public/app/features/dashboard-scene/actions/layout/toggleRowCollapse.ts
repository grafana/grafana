import { t } from '@grafana/i18n';

import { type RowItem } from '../../scene/layout-rows/RowItem';
import { edit } from '../utils/edit';

export function toggleRowCollapse(row: RowItem) {
  const { collapse } = row.state;
  const isCollapsing = !collapse;

  edit({
    meta: { actionId: isCollapsing ? 'row.collapse' : 'row.expand' },
    description: isCollapsing
      ? t('dashboard.edit-actions.collapse-row', 'Collapse row')
      : t('dashboard.edit-actions.expand-row', 'Expand row'),
    source: row,
    perform: () => row.setCollapsedState(isCollapsing),
    undo: () => row.setState({ collapse }),
  });
}
