import { useEffect, useState } from 'react';
import { Subscription } from 'rxjs';

import {
  DataHoverClearEvent,
  DataHoverEvent,
  FALLBACK_COLOR,
  FieldColorModeId,
  type FieldDisplay,
  formattedValueToString,
  getFieldDisplayValues,
  type PanelProps,
} from '@grafana/data';
import { PanelDataErrorView } from '@grafana/runtime';
import { type HideSeriesConfig, SortOrder, LegendDisplayMode } from '@grafana/schema';
import { SeriesVisibilityChangeBehavior, usePanelContext, VizLayout, VizLegend, type VizLegendItem } from '@grafana/ui';
import { useTheme2 } from '@grafana/ui/themes';

import { PieChart, computeGradientFills } from './PieChart';
import { type PieChartLegendOptions, PieChartLegendValues, type Options } from './panelcfg.gen';
import { filterDisplayItems, sumDisplayItemsReducer } from './utils';

const defaultLegendOptions: PieChartLegendOptions = {
  displayMode: LegendDisplayMode.List,
  showLegend: true,
  placement: 'right',
  calcs: [],
  values: [PieChartLegendValues.Percent],
};

interface Props extends PanelProps<Options> {}

/**
 * @beta
 */
export function PieChartPanel(props: Props) {
  const { data, timeZone, fieldConfig, replaceVariables, width, height, options, id } = props;

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
    return <PanelDataErrorView panelId={id} fieldConfig={fieldConfig} data={data} />;
  }

  // Compute gradient fills once here so both the chart and the legend share
  // the exact same color map (same rank order, same interpolated hex values).
  //
  // Items are grouped by their (fixedColor, gradientColorTo) gradient config.
  // This handles three cases uniformly:
  //   1. Panel default = Gradient → all non-overridden items share one group.
  //   2. Per-field gradient override (e.g. byType, byRegexp) → items sharing
  //      the same override colors form their own group and are ranked together.
  //   3. Non-gradient items (fixed color, palette, etc.) → skipped entirely,
  //      fall back to display.color in the arc renderer.
  const allGradientFills = new Map<FieldDisplay, string>();
  const gradientGroups = new Map<string, { items: FieldDisplay[]; from: string; to: string }>();

  for (const item of fieldDisplayValues) {
    if (!filterDisplayItems(item)) {
      continue;
    }
    if (item.field.color?.mode !== FieldColorModeId.Gradient) {
      continue;
    }
    const fixedColor = item.field.color.fixedColor ?? '#73BF69';
    const gradientColorTo = item.field.color.gradientColorTo ?? '#F2495C';
    const key = `${fixedColor}|${gradientColorTo}`;
    let group = gradientGroups.get(key);
    if (!group) {
      group = {
        items: [],
        from: theme.visualization.getColorByName(fixedColor),
        to: theme.visualization.getColorByName(gradientColorTo),
      };
      gradientGroups.set(key, group);
    }
    group.items.push(item);
  }

  for (const { items, from, to } of gradientGroups.values()) {
    for (const [item, color] of computeGradientFills(items, from, to)) {
      allGradientFills.set(item, color);
    }
  }

  const gradientFills = allGradientFills.size > 0 ? allGradientFills : undefined;

  return (
    <VizLayout width={width} height={height} legend={getLegend(props, fieldDisplayValues, gradientFills)}>
      {(vizWidth: number, vizHeight: number) => {
        return (
          <PieChart
            width={vizWidth}
            height={vizHeight}
            highlightedTitle={highlightedTitle}
            fieldDisplayValues={fieldDisplayValues}
            tooltipOptions={options.tooltip}
            pieType={options.pieType}
            sort={options.sort}
            displayLabels={options.displayLabels}
            gradientFills={gradientFills}
          />
        );
      }}
    </VizLayout>
  );
}

function getLegend(props: Props, displayValues: FieldDisplay[], gradientFills?: Map<FieldDisplay, string>) {
  const legendOptions = props.options.legend ?? defaultLegendOptions;

  if (legendOptions.showLegend === false) {
    return undefined;
  }

  const sortedDisplayValues = displayValues.sort(comparePieChartItemsByValue(props.options.sort));

  const total = displayValues.filter(filterDisplayItems).reduce(sumDisplayItemsReducer, 0);

  const legendItems: VizLegendItem[] = sortedDisplayValues
    .map<VizLegendItem | undefined>((value: FieldDisplay, idx: number) => {
      const hideFrom: HideSeriesConfig = value.field.custom?.hideFrom ?? {};

      if (hideFrom.legend) {
        return undefined;
      }

      const hideFromViz = Boolean(hideFrom.viz);

      const display = value.display;
      return {
        label: display.title ?? '',
        color: gradientFills?.get(value) ?? display.color ?? FALLBACK_COLOR,
        yAxis: 1,
        disabled: hideFromViz,
        getItemKey: () => (display.title ?? '') + idx,
        getDisplayValues: () => {
          const valuesToShow = legendOptions.values ?? [];
          let displayValues = [];

          if (valuesToShow.includes(PieChartLegendValues.Value)) {
            displayValues.push({ numeric: display.numeric, text: formattedValueToString(display), title: 'Value' });
          }

          if (valuesToShow.includes(PieChartLegendValues.Percent)) {
            const fractionOfTotal = hideFromViz ? 0 : display.numeric / total;
            const percentOfTotal = fractionOfTotal * 100;

            displayValues.push({
              numeric: fractionOfTotal,
              percent: percentOfTotal,
              text:
                hideFromViz || isNaN(fractionOfTotal)
                  ? (props.fieldConfig.defaults.noValue ?? '-')
                  : percentOfTotal.toFixed(value.field.decimals ?? 0) + '%',
              title: valuesToShow.length > 1 ? 'Percent' : '',
            });
          }

          return displayValues;
        },
      };
    })
    .filter((i): i is VizLegendItem => !!i);

  return (
    <VizLayout.Legend placement={legendOptions.placement} width={legendOptions.width}>
      <VizLegend
        items={legendItems}
        seriesVisibilityChangeBehavior={SeriesVisibilityChangeBehavior.Hide}
        placement={legendOptions.placement}
        displayMode={legendOptions.displayMode}
      />
    </VizLayout.Legend>
  );
}

export function comparePieChartItemsByValue(sort: SortOrder): (a: FieldDisplay, b: FieldDisplay) => number {
  return function (a: FieldDisplay, b: FieldDisplay) {
    if (isNaN(a.display.numeric)) {
      return 1;
    }
    if (isNaN(b.display.numeric)) {
      return -1;
    }

    if (sort === SortOrder.Descending) {
      return b.display.numeric - a.display.numeric;
    }
    if (sort === SortOrder.Ascending) {
      return a.display.numeric - b.display.numeric;
    }

    return 0;
  };
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
