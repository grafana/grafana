import { useCallback, useMemo, useState } from 'react';
import * as React from 'react';

import { DataHoverClearEvent, DataHoverEvent } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { LegendDisplayMode } from '@grafana/schema';

import { SeriesVisibilityChangeMode, usePanelContext } from '../PanelChrome';

import { LimitedDataDisclaimer } from './LimitedDataDisclaimer';
import { VizLegendList } from './VizLegendList';
import { VizLegendTable } from './VizLegendTable';
import { LegendProps, SeriesVisibilityChangeBehavior, VizLegendItem } from './types';
import { mapMouseEventToMode } from './utils';

const DEFAULT_SERIES_COUNT = 30;

function wrapWithLimit(
  children: React.ReactNode,
  shown: number,
  total: number,
  setItemLimit: React.Dispatch<React.SetStateAction<number>>
) {
  if (shown < total) {
    return (
      <div style={{ position: 'relative' }}>
        {children}
        <LimitedDataDisclaimer
          toggleShowAllSeries={() => setItemLimit(-1)}
          info={
            <Trans i18nKey={'legend.container.show-only-series'}>
              Showing {{ shown }} / {{ total }} series
            </Trans>
          }
          tooltip={t('legend.container.content', 'Showing too many series will impact browser performance')}
          buttonLabel={<Trans i18nKey={'legend.container.show-all-series'}>Show all series</Trans>}
        />
      </div>
    );
  }

  return children;
}

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
  const { eventBus, onToggleSeriesVisibility, onToggleLegendSort } = usePanelContext();

  const [itemLimit, setItemLimit] = useState(DEFAULT_SERIES_COUNT);

  const limitedItems = useMemo(() => {
    return itemLimit > 0 ? items.slice(0, itemLimit) : items;
  }, [items, itemLimit]);

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

  switch (displayMode) {
    case LegendDisplayMode.Table:
      return wrapWithLimit(
        <VizLegendTable<T>
          className={className}
          items={limitedItems}
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
        />,
        limitedItems.length,
        items.length,
        setItemLimit
      );
    case LegendDisplayMode.List:
      const isThresholdsEnabled = thresholdItems && thresholdItems.length > 1;
      const isValueMappingEnabled = mappingItems && mappingItems.length > 0;
      return wrapWithLimit(
        <>
          {/* render items when single series and there is no thresholds and no value mappings
           * render items when multi series and there is no thresholds
           */}
          {!isThresholdsEnabled &&
            (!isValueMappingEnabled || limitedItems.length > 1) &&
            makeVizLegendList(limitedItems)}
          {/* render threshold colors if From thresholds scheme selected */}
          {isThresholdsEnabled && makeVizLegendList(thresholdItems)}
          {/* render value mapping colors */}
          {isValueMappingEnabled && makeVizLegendList(mappingItems)}
        </>,
        limitedItems.length,
        items.length,
        setItemLimit
      );
    default:
      return null;
  }
}

VizLegend.displayName = 'VizLegend';
