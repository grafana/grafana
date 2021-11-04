import React, { useEffect, useState } from 'react';
import { LegendDisplayMode } from '@grafana/schema';
import {
  DataHoverClearEvent,
  DataHoverEvent,
  FALLBACK_COLOR,
  FieldDisplay,
  formattedValueToString,
  getFieldDisplayValues,
  PanelProps,
} from '@grafana/data';

import { PieChart } from './PieChart';

import { PieChartLegendOptions, PieChartLegendValues, PieChartOptions } from './types';
import { Subscription } from 'rxjs';
import {
  SeriesVisibilityChangeBehavior,
  usePanelContext,
  useTheme2,
  VizLayout,
  VizLegend,
  VizLegendItem,
} from '@grafana/ui';
import { filterDisplayItems, sumDisplayItemsReducer } from './utils';

const defaultLegendOptions: PieChartLegendOptions = {
  displayMode: LegendDisplayMode.List,
  placement: 'right',
  calcs: [],
  values: [PieChartLegendValues.Percent],
};

interface Props extends PanelProps<PieChartOptions> {}

/**
 * @beta
 */
export function PieChartPanel(props: Props) {
  const { data, timeZone, fieldConfig, replaceVariables, width, height, options } = props;

  const theme = useTheme2();
  const highlightedTitle = useSliceHighlightState();
  const fieldDisplayValues = getFieldDisplayValues({
    fieldConfig,
    reduceOptions: options.reduceOptions,
    data: data.series,
    theme: theme,
    replaceVariables,
    timeZone,
  });

  if (!hasFrames(fieldDisplayValues)) {
    return (
      <div className="panel-empty">
        <p>No data</p>
      </div>
    );
  }

  return (
    <VizLayout width={width} height={height} legend={getLegend(props, fieldDisplayValues)}>
      {(vizWidth: number, vizHeight: number) => {
        return (
          <PieChart
            width={vizWidth}
            height={vizHeight}
            highlightedTitle={highlightedTitle}
            fieldDisplayValues={fieldDisplayValues}
            tooltipOptions={options.tooltip}
            pieType={options.pieType}
            displayLabels={options.displayLabels}
          />
        );
      }}
    </VizLayout>
  );
}

function getLegend(props: Props, displayValues: FieldDisplay[]) {
  const legendOptions = props.options.legend ?? defaultLegendOptions;

  if (legendOptions.displayMode === LegendDisplayMode.Hidden) {
    return undefined;
  }
  const total = displayValues.filter(filterDisplayItems).reduce(sumDisplayItemsReducer, 0);

  const legendItems = displayValues
    // Since the pie chart is always sorted, let's sort the legend as well.
    .sort((a, b) => {
      if (isNaN(a.display.numeric)) {
        return 1;
      } else if (isNaN(b.display.numeric)) {
        return -1;
      } else {
        return b.display.numeric - a.display.numeric;
      }
    })
    .map<VizLegendItem>((value, idx) => {
      const hidden = value.field.custom.hideFrom.viz;
      const display = value.display;
      return {
        label: display.title ?? '',
        color: display.color ?? FALLBACK_COLOR,
        yAxis: 1,
        disabled: hidden,
        getItemKey: () => (display.title ?? '') + idx,
        getDisplayValues: () => {
          const valuesToShow = legendOptions.values ?? [];
          let displayValues = [];

          if (valuesToShow.includes(PieChartLegendValues.Value)) {
            displayValues.push({ numeric: display.numeric, text: formattedValueToString(display), title: 'Value' });
          }

          if (valuesToShow.includes(PieChartLegendValues.Percent)) {
            const fractionOfTotal = hidden ? 0 : display.numeric / total;
            const percentOfTotal = fractionOfTotal * 100;

            displayValues.push({
              numeric: fractionOfTotal,
              percent: percentOfTotal,
              text:
                hidden || isNaN(fractionOfTotal)
                  ? props.fieldConfig.defaults.noValue ?? '-'
                  : percentOfTotal.toFixed(0) + '%',
              title: valuesToShow.length > 1 ? 'Percent' : '',
            });
          }

          return displayValues;
        },
      };
    });

  return (
    <VizLegend
      items={legendItems}
      seriesVisibilityChangeBehavior={SeriesVisibilityChangeBehavior.Hide}
      placement={legendOptions.placement}
      displayMode={legendOptions.displayMode}
    />
  );
}

function hasFrames(fieldDisplayValues: FieldDisplay[]) {
  return fieldDisplayValues.some((fd) => fd.view?.dataFrame.length);
}

function useSliceHighlightState() {
  const [highlightedTitle, setHighlightedTitle] = useState<string>();
  const { eventBus } = usePanelContext();

  useEffect(() => {
    const setHighlightedSlice = (event: DataHoverEvent) => {
      setHighlightedTitle(event.payload.dataId);
    };

    const resetHighlightedSlice = (event: DataHoverClearEvent) => {
      setHighlightedTitle(undefined);
    };

    const subs = new Subscription();
    subs.add(eventBus.getStream(DataHoverEvent).subscribe({ next: setHighlightedSlice }));
    subs.add(eventBus.getStream(DataHoverClearEvent).subscribe({ next: resetHighlightedSlice }));

    return () => {
      subs.unsubscribe();
    };
  }, [setHighlightedTitle, eventBus]);

  return highlightedTitle;
}
