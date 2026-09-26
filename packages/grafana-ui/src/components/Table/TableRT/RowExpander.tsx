import { t } from '@grafana/i18n';

import { Icon } from '../../Icon/Icon';
import { type GrafanaTableRow } from '../types';

import { type TableStyles } from './styles';

export interface Props {
  row: GrafanaTableRow;
  tableStyles: TableStyles;
}

export function RowExpander({ row, tableStyles }: Props) {
  return (
    // react-table v7 spread only a click handler here, keyboard support is a separate change
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div className={tableStyles.expanderCell} onClick={row.getToggleExpandedHandler()}>
      <Icon
        aria-label={
          row.getIsExpanded()
            ? t('grafana-ui.row-expander.collapse', 'Collapse row')
            : t('grafana-ui.row-expander.expand', 'Expand row')
        }
        name={row.getIsExpanded() ? 'angle-down' : 'angle-right'}
        size="lg"
      />
    </div>
  );
}
