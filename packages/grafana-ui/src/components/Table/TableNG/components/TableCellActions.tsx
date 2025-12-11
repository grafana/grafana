import { memo } from 'react';

import { t } from '@grafana/i18n';

import { IconButton } from '../../../IconButton/IconButton';
import { FILTER_FOR_OPERATOR, FILTER_OUT_OPERATOR, TableCellActionsProps } from '../types';
import { buildInspectValue } from '../utils';

export const TableCellActions = memo(
  ({ field, value, setInspectCell, onCellFilterAdded, className, cellInspect, showFilters }: TableCellActionsProps) => (
    // stopping propagation to prevent clicks within the actions menu from triggering the cell click events
    // for things like the data links tooltip.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div className={className} onClick={(ev) => ev.stopPropagation()}>
      {cellInspect && (
        <IconButton
          name="eye"
          aria-label={t('grafana-ui.table.cell-inspect-tooltip', 'Inspect value')}
          onClick={() => {
            const [inspectValue, mode] = buildInspectValue(value, field);
            setInspectCell({ value: inspectValue, mode });
          }}
        />
      )}
      {showFilters && (
        <>
          <IconButton
            name={'filter-plus'}
            aria-label={t('grafana-ui.table.cell-filter-on', 'Filter for value')}
            onClick={() => {
              onCellFilterAdded?.({
                key: field.name,
                operator: FILTER_FOR_OPERATOR,
                value: String(value ?? ''),
              });
            }}
          />
          <IconButton
            name={'filter-minus'}
            aria-label={t('grafana-ui.table.cell-filter-out', 'Filter out value')}
            onClick={() => {
              onCellFilterAdded?.({
                key: field.name,
                operator: FILTER_OUT_OPERATOR,
                value: String(value ?? ''),
              });
            }}
          />
        </>
      )}
    </div>
  )
);
TableCellActions.displayName = 'TableCellActions';
