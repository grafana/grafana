import { type Key, type ReactNode } from 'react';
import { type RenderRowProps, Row } from 'react-data-grid';

import { DataHoverClearEvent, DataHoverEvent, type Field, FieldType } from '@grafana/data';

import { type PanelContext } from '../../PanelChrome';

import type { TableRow, TableSummaryRow } from './types';

/**
 * @internal
 * Factory for the `renderRow` prop on DataGrid. Applies aria attributes and shared-crosshair event handlers.
 */
export const renderRowFactory =
  (
    fields: Field[],
    panelContext: PanelContext,
    expandedRows: Set<string>,
    enableSharedCrosshair: boolean,
    getStableKey: (rowIdx: number) => string
  ) =>
  // eslint-disable-next-line react/display-name
  (key: Key, props: RenderRowProps<TableRow, TableSummaryRow>): ReactNode => {
    const { row } = props;
    const rowIdx = row.__index;
    const isExpanded = expandedRows.has(getStableKey(rowIdx));

    // Don't render non-expanded child rows
    if (row.__depth === 1) {
      if (!isExpanded) {
        return null;
      }
      return <Row key={key} aria-level={row.__index + 1} aria-expanded={isExpanded} {...props} />;
    }

    const handlers: Partial<typeof props> = {};
    if (enableSharedCrosshair) {
      const timeField = fields.find((f) => f.type === FieldType.time);
      if (timeField) {
        handlers.onMouseEnter = () => {
          panelContext.eventBus.publish(
            new DataHoverEvent({
              point: {
                time: timeField?.values[rowIdx],
              },
            })
          );
        };
        handlers.onMouseLeave = () => {
          panelContext.eventBus.publish(new DataHoverClearEvent());
        };
      }
    }

    return <Row key={key} {...props} {...handlers} />;
  };
