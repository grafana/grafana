import { css } from '@emotion/css';
import { CellProps, HeaderProps } from 'react-table';

import { t } from '../../../utils/i18n';
import { IconButton } from '../../IconButton/IconButton';

const expanderContainerStyles = css({
  display: 'flex',
  alignItems: 'center',
  height: '100%',
});

export function ExpanderCell<K extends object>({ row, __rowID }: CellProps<K, void>) {
  return (
    <div className={expanderContainerStyles}>
      <IconButton
        tooltip={t('grafana-ui.interactive-table.expand-row-tooltip', 'Toggle row expanded')}
        aria-controls={__rowID}
        // @ts-expect-error react-table doesn't ship with useExpanded types and we can't use declaration merging without affecting the table viz
        name={row.isExpanded ? 'angle-down' : 'angle-right'}
        // @ts-expect-error same as the line above
        aria-expanded={row.isExpanded}
        // @ts-expect-error same as the line above
        {...row.getToggleRowExpandedProps()}
        size="lg"
      />
    </div>
  );
}

export function ExpanderHeader<K extends object>({ isAllRowsExpanded, toggleAllRowsExpanded }: HeaderProps<K>) {
  return (
    <div className={expanderContainerStyles}>
      <IconButton
        aria-label={
          !isAllRowsExpanded
            ? t('grafana-ui.interactive-table.aria-label-expand-all', 'Expand all rows')
            : t('grafana-ui.interactive-table.aria-label-collapse-all', 'Collapse all rows')
        }
        name={!isAllRowsExpanded ? 'table-expand-all' : 'table-collapse-all'}
        onClick={() => toggleAllRowsExpanded()}
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
