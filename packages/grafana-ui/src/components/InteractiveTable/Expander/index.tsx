import { css } from '@emotion/css';

import { t, Trans } from '@grafana/i18n';

import { IconButton } from '../../IconButton/IconButton';
import { type CellProps, type HeaderProps } from '../types';

const expanderContainerStyles = css({
  display: 'flex',
  alignItems: 'center',
  height: '100%',
});

export function ExpanderCell<K extends object>({ row, __rowID }: CellProps<K>) {
  return (
    <div className={expanderContainerStyles}>
      <IconButton
        tooltip={t('grafana-ui.interactive-table.expand-row-tooltip', 'Toggle row expanded')}
        aria-controls={row.getIsExpanded() ? __rowID : undefined}
        name={row.getIsExpanded() ? 'angle-down' : 'angle-right'}
        aria-expanded={row.getIsExpanded()}
        onClick={row.getToggleExpandedHandler()}
        size="lg"
      />
    </div>
  );
}

export function EmptyExpanderHeader() {
  return (
    <span className="sr-only">
      <Trans i18nKey="grafana-ui.interactive-table.expand-row-header">Row expander</Trans>
    </span>
  );
}

export function ExpanderHeader<K extends object>({ table }: HeaderProps<K>) {
  const isAllRowsExpanded = table.getIsAllRowsExpanded();
  return (
    <div className={expanderContainerStyles}>
      <IconButton
        aria-label={
          !isAllRowsExpanded
            ? t('grafana-ui.interactive-table.aria-label-expand-all', 'Expand all rows')
            : t('grafana-ui.interactive-table.aria-label-collapse-all', 'Collapse all rows')
        }
        name={!isAllRowsExpanded ? 'table-expand-all' : 'table-collapse-all'}
        onClick={() => table.toggleAllRowsExpanded()}
        size={'lg'}
        tooltip={
          !isAllRowsExpanded
            ? t('grafana-ui.interactive-table.tooltip-expand-all', 'Expand all rows')
            : t('grafana-ui.interactive-table.tooltip-collapse-all', 'Collapse all rows')
        }
        variant={'secondary'}
      />
    </div>
  );
}
