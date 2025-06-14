import { useCallback } from 'react';
import * as React from 'react';

import { t } from '@grafana/i18n';

import { IconSize } from '../../types/icon';
import { IconButton } from '../IconButton/IconButton';
import { Stack } from '../Layout/Stack/Stack';
import { TooltipPlacement } from '../Tooltip/types';

import { TableCellInspectorMode } from './TableCellInspector';
import { FILTER_FOR_OPERATOR, FILTER_OUT_OPERATOR, TableCellProps } from './types';
import { getTextAlign } from './utils';

interface CellActionProps extends TableCellProps {
  previewMode: TableCellInspectorMode;
}

interface CommonButtonProps {
  size: IconSize;
  showFilters?: boolean;
  tooltipPlacement: TooltipPlacement;
}

export function CellActions({
  field,
  cell,
  previewMode,
  showFilters,
  onCellFilterAdded,
  setInspectCell,
}: CellActionProps) {
  const isRightAligned = getTextAlign(field) === 'flex-end';
  const inspectEnabled = Boolean(field.config.custom?.inspect);
  const commonButtonProps: CommonButtonProps = {
    size: 'sm',
    tooltipPlacement: 'top',
  };

  const onFilterFor = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      if (onCellFilterAdded) {
        onCellFilterAdded({ key: field.name, operator: FILTER_FOR_OPERATOR, value: cell.value });
      }
    },
    [cell, field, onCellFilterAdded]
  );
  const onFilterOut = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      if (onCellFilterAdded) {
        onCellFilterAdded({ key: field.name, operator: FILTER_OUT_OPERATOR, value: cell.value });
      }
    },
    [cell, field, onCellFilterAdded]
  );

  return (
    <div className={`cellActions${isRightAligned ? ' cellActionsLeft' : ''}`}>
      <Stack gap={0.5}>
        {inspectEnabled && (
          <IconButton
            name="eye"
            tooltip={t('grafana-ui.table.cell-inspect', 'Inspect value')}
            onClick={() => {
              if (setInspectCell) {
                setInspectCell({ value: cell.value, mode: previewMode });
              }
            }}
            {...commonButtonProps}
          />
        )}
        {showFilters && (
          <IconButton
            name={'search-plus'}
            onClick={onFilterFor}
            tooltip={t('grafana-ui.table.cell-filter-on', 'Filter for value')}
            {...commonButtonProps}
          />
        )}
        {showFilters && (
          <IconButton
            name={'search-minus'}
            onClick={onFilterOut}
            tooltip={t('grafana-ui.table.cell-filter-out', 'Filter out value')}
            {...commonButtonProps}
          />
        )}
      </Stack>
    </div>
  );
}
