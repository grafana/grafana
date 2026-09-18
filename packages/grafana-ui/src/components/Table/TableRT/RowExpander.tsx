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
  const toggleExpanded = row.getToggleExpandedHandler();

  return (
    <div
      role="button"
      tabIndex={0}
      aria-expanded={isExpanded}
      aria-label={
        isExpanded
          ? t('grafana-ui.row-expander.collapse', 'Collapse row')
          : t('grafana-ui.row-expander.expand', 'Expand row')
      }
      className={tableStyles.expanderCell}
      onClick={toggleExpanded}
      onKeyDown={(event) => {
        if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault();
          toggleExpanded();
        }
      }}
    >
      <Icon name={isExpanded ? 'angle-down' : 'angle-right'} size="lg" aria-hidden="true" />
    </div>
  );
}
