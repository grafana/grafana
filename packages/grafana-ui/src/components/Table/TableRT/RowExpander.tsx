import { t } from '@grafana/i18n';

import { Icon } from '../../Icon/Icon';
import { type GrafanaTableRow } from '../types';

import { type TableStyles } from './styles';

export interface Props {
  row: GrafanaTableRow;
  tableStyles: TableStyles;
}

export function RowExpander({ row, tableStyles }: Props) {
  const isExpanded = row.getIsExpanded();
  return (
    <div className={tableStyles.expanderCell} onClick={row.getToggleExpandedHandler()}>
      <Icon
        aria-label={
          isExpanded
            ? t('grafana-ui.row-expander.collapse', 'Collapse row')
            : t('grafana-ui.row-expander.expand', 'Expand row')
        }
        name={isExpanded ? 'angle-down' : 'angle-right'}
        size="lg"
      />
    </div>
  );
}
