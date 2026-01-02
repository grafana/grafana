import { css } from '@emotion/css';
import { useCallback } from 'react';
import * as React from 'react';

import { DataHoverClearEvent, DataHoverEvent } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { LegendDisplayMode } from '@grafana/schema';

import { Button } from '../Button/Button';
import { SeriesVisibilityChangeMode, usePanelContext } from '../PanelChrome';

import { VizLegendList } from './VizLegendList';
import { VizLegendTable } from './VizLegendTable';
import { LegendProps, SeriesVisibilityChangeBehavior, VizLegendItem } from './types';
import { mapMouseEventToMode } from './utils';

/**
 * @public
 *
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/plugins-vizlegend--docs
 */
export function VizLegend<T>({
  items,
  thresholdItems,
  mappingItems,
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
  const { eventBus, onResetAllSeriesVisibility, onToggleSeriesVisibility, onToggleLegendSort } = usePanelContext();

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

  const makeVizLegendList = useCallback(
    (items: VizLegendItem[]) => {
      return (
        <VizLegendList<T>
          className={className}
          placement={placement}
          onLabelMouseOver={onMouseOver}
          onLabelMouseOut={onMouseOut}
          onLabelClick={onLegendLabelClick}
          itemRenderer={itemRenderer}
          readonly={readonly}
          items={items}
        />
      );
    },
    [className, placement, onMouseOver, onMouseOut, onLegendLabelClick, itemRenderer, readonly]
  );

  if (onResetAllSeriesVisibility && items.every((item) => (item.fieldName ?? item.label) && item.disabled)) {
    return (
      <div className={css({ paddingTop: '0.5em' })}>
        <Button
          size="sm"
          tooltip={t(
            'grafana-ui.viz-legend.show-all-series-tooltip',
            'Currently loaded series are hidden by previous selection. Click to show all series.'
          )}
          variant="secondary"
          onClick={() => {
            onResetAllSeriesVisibility();
          }}
        >
          <Trans i18nKey="grafana-ui.viz-legend.show-all-series">Show all series</Trans>
        </Button>
      </div>
    );
  }

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
    case LegendDisplayMode.List:
      const isThresholdsEnabled = thresholdItems && thresholdItems.length > 1;
      const isValueMappingEnabled = mappingItems && mappingItems.length > 0;
      return (
        <>
          {/* render items when single series and there is no thresholds and no value mappings
           * render items when multi series and there is no thresholds
           */}
          {!isThresholdsEnabled && (!isValueMappingEnabled || items.length > 1) && makeVizLegendList(items)}
          {/* render threshold colors if From thresholds scheme selected */}
          {isThresholdsEnabled && makeVizLegendList(thresholdItems)}
          {/* render value mapping colors */}
          {isValueMappingEnabled && makeVizLegendList(mappingItems)}
        </>
      );
    default:
      return null;
  }
}

VizLegend.displayName = 'VizLegend';
