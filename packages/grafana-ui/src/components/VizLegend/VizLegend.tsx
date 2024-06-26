import { useCallback } from 'react';
import * as React from 'react';

import { DataHoverClearEvent, DataHoverEvent } from '@grafana/data';
import { LegendDisplayMode } from '@grafana/schema';

import { SeriesVisibilityChangeMode, usePanelContext } from '../PanelChrome';

import { VizLegendList } from './VizLegendList';
import { VizLegendTable } from './VizLegendTable';
import { LegendProps, SeriesVisibilityChangeBehavior, VizLegendItem } from './types';
import { mapMouseEventToMode } from './utils';

/**
 * @public
 */
export function VizLegend<T>({
  items,
  displayMode,
  sortBy: sortKey,
  seriesVisibilityChangeBehavior = SeriesVisibilityChangeBehavior.Isolate,
  sortDesc,
  onLabelClick,
  onToggleSort,
  placement,
  className,
  itemRenderer,
  readonly,
  isSortable,
}: LegendProps<T>) {
  // JEV: ADDITION: add other callbacks to panel context? override/config callbacks?
  const { eventBus, onToggleSeriesVisibility, onToggleLegendSort } = usePanelContext();

  // JEV: OBSERVATION: basic event handling/interactivity for legend items handled in PanelContext? How???
  // JEV: REFACTOR: abstract this to it's own hook.
  const onMouseOver = useCallback(
    (
      item: VizLegendItem,
      event: React.MouseEvent<HTMLButtonElement, MouseEvent> | React.FocusEvent<HTMLButtonElement>
    ) => {
      eventBus?.publish({
        type: DataHoverEvent.type,
        payload: {
          raw: event,
          x: 0,
          y: 0,
          dataId: item.label,
        },
      });
    },
    [eventBus]
  );

  const onMouseOut = useCallback(
    (
      item: VizLegendItem,
      event: React.MouseEvent<HTMLButtonElement, MouseEvent> | React.FocusEvent<HTMLButtonElement>
    ) => {
      eventBus?.publish({
        type: DataHoverClearEvent.type,
        payload: {
          raw: event,
          x: 0,
          y: 0,
          dataId: item.label,
        },
      });
    },
    [eventBus]
  );

  const onLegendLabelClick = useCallback(
    (item: VizLegendItem, event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      // JEV: PERK: onLabelClick custom prop
      if (onLabelClick) {
        onLabelClick(item, event);
      }
      if (onToggleSeriesVisibility) {
        onToggleSeriesVisibility(
          item.fieldName ?? item.label,
          seriesVisibilityChangeBehavior === SeriesVisibilityChangeBehavior.Hide
            ? SeriesVisibilityChangeMode.AppendToSelection
            : mapMouseEventToMode(event)
        );
      }
    },
    [onToggleSeriesVisibility, onLabelClick, seriesVisibilityChangeBehavior]
  );

  // JEV: REFACTOR: Make into own function?
  switch (displayMode) {
    case LegendDisplayMode.Table:
      return (
        <VizLegendTable<T>
          className={className}
          items={items}
          placement={placement}
          sortBy={sortKey}
          sortDesc={sortDesc}
          onLabelClick={onLegendLabelClick}
          onToggleSort={onToggleSort || onToggleLegendSort}
          onLabelMouseOver={onMouseOver}
          onLabelMouseOut={onMouseOut}
          itemRenderer={itemRenderer}
          readonly={readonly}
          isSortable={isSortable}
        />
      );
    // JEV: REFACTOR: Do we even need a "list" component in general? Just disable some table features?
    case LegendDisplayMode.List:
      return (
        <VizLegendList<T>
          className={className}
          items={items}
          placement={placement}
          onLabelMouseOver={onMouseOver}
          onLabelMouseOut={onMouseOut}
          onLabelClick={onLegendLabelClick}
          itemRenderer={itemRenderer}
          readonly={readonly}
        />
      );
    default:
      return null;
  }
}

// JEV: QUESTION: What does this do?
// IHOR: This is a displayName for React DevTools. It's used to give a component a name in the React DevTools.
// It's useful for debugging purposes. In that case, it's the same as the component name.
// So, I don't see any reason to keep it.
VizLegend.displayName = 'VizLegend';
