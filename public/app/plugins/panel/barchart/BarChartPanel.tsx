import { useMemo } from 'react';

import { PanelProps, VizOrientation } from '@grafana/data';
import { config, PanelDataErrorView } from '@grafana/runtime';
import {
  AdHocFilterItem,
  TooltipDisplayMode,
  TooltipPlugin2,
  UPLOT_AXIS_FONT_SIZE,
  UPlotChart,
  VizLayout,
  measureText,
  usePanelContext,
  useTheme2,
} from '@grafana/ui';
import { FILTER_FOR_OPERATOR, TooltipHoverMode } from '@grafana/ui/internal';

import { AdHocFilterModel } from '../../../../../packages/grafana-ui/src/components/VizTooltip/VizTooltipFooter';
import { TimeSeriesTooltip } from '../timeseries/TimeSeriesTooltip';

import { BarChartLegend, hasVisibleLegendSeries } from './BarChartLegend';
import { Options } from './panelcfg.gen';
import { prepConfig, prepSeries } from './utils';

const charWidth = measureText('M', UPLOT_AXIS_FONT_SIZE).width;
const toRads = Math.PI / 180;

export const BarChartPanel = (props: PanelProps<Options>) => {
  const { data, options, fieldConfig, width, height, timeZone, id, replaceVariables } = props;

  // will need this if joining on time to re-create data links
  // const { dataLinkPostProcessor } = usePanelContext();

  const theme = useTheme2();
  const { onAddAdHocFilter } = usePanelContext();

  const {
    barWidth,
    barRadius = 0,
    showValue,
    groupWidth,
    stacking,
    legend,
    tooltip,
    text,
    xTickLabelRotation,
    xTickLabelSpacing,
    fullHighlight,
    xField,
    colorByField,
  } = options;

  // size-dependent, calculated opts that should cause viz re-config
  let { orientation, xTickLabelMaxLength = 0 } = options;

  orientation =
    orientation === VizOrientation.Auto
      ? width < height
        ? VizOrientation.Horizontal
        : VizOrientation.Vertical
      : orientation;

  // TODO: this can be moved into axis calc internally, no need to re-config based on this
  // should be based on vizHeight, not full height?
  xTickLabelMaxLength =
    xTickLabelRotation === 0
      ? Infinity // should this calc using spacing between groups?
      : xTickLabelMaxLength ||
        // auto max length clamps to half viz height, subracts 3 chars for ... ellipsis
        Math.floor(height / 2 / Math.sin(Math.abs(xTickLabelRotation * toRads)) / charWidth - 3);

  // TODO: config data links
  const info = useMemo(
    () => prepSeries(data.series, fieldConfig, stacking, theme, xField, colorByField),
    [data.series, fieldConfig, stacking, theme, xField, colorByField]
  );

  const vizSeries = useMemo(
    () =>
      info.series.map((frame) => ({
        ...frame,
        fields: frame.fields.filter((field, i) => i === 0 || !field.state?.hideFrom?.viz),
      })),
    [info.series]
  );

  const xGroupsCount = vizSeries[0]?.length ?? 0;
  const seriesCount = vizSeries[0]?.fields.length ?? 0;
  const totalSeries = Math.max(0, (info.series[0]?.fields.length ?? 0) - 1);

  let { builder, prepData } = useMemo(
    () => {
      return xGroupsCount === 0
        ? { builder: null, prepData: null }
        : prepConfig({ series: vizSeries, totalSeries, color: info.color, orientation, options, timeZone, theme });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      orientation,
      timeZone,
      props.data.structureRev,

      totalSeries,
      seriesCount,
      xGroupsCount,

      barWidth,
      barRadius,
      showValue,
      groupWidth,
      stacking,
      legend,
      tooltip,
      text?.valueSize, // cause text obj is re-created each time?
      xTickLabelRotation,
      xTickLabelSpacing,
      fullHighlight,
      xField,
      colorByField,
      xTickLabelMaxLength, // maybe not?
      // props.fieldConfig, // usePrevious hideFrom on all fields?
    ]
  );

  const plotData = useMemo(
    () => (prepData == null ? [] : prepData(vizSeries, info.color)),
    [prepData, vizSeries, info.color]
  );

  if (info.warn != null || builder == null) {
    return (
      <PanelDataErrorView
        panelId={id}
        fieldConfig={fieldConfig}
        data={data}
        message={info.warn ?? ''}
        needsNumberField={true}
      />
    );
  }

  const legendComp =
    legend.showLegend && hasVisibleLegendSeries(builder, info.series!) ? (
      <BarChartLegend data={info.series!} colorField={info.color} {...legend} />
    ) : null;

  return (
    <VizLayout
      width={props.width}
      height={props.height}
      // legend={<BarChartLegend frame={info.series![0]} colorField={info.color} {...legend} />}
      legend={legendComp}
    >
      {(vizWidth, vizHeight) => (
        <UPlotChart config={builder!} data={plotData} width={vizWidth} height={vizHeight}>
          {props.options.tooltip.mode !== TooltipDisplayMode.None && (
            <TooltipPlugin2
              config={builder}
              maxWidth={options.tooltip.maxWidth}
              hoverMode={
                options.tooltip.mode === TooltipDisplayMode.Single ? TooltipHoverMode.xOne : TooltipHoverMode.xAll
              }
              getDataLinks={(seriesIdx, dataIdx) =>
                vizSeries[0].fields[seriesIdx].getLinks?.({ valueRowIndex: dataIdx }) ?? []
              }
              getAdHocFilters={(seriesIdx, dataIdx) => {
                const xField = vizSeries[0].fields[0];

                // Check if the field supports filtering (similar to table implementation)
                // We only show filters on filterable fields (xField.config.filterable).
                // Fields will have been marked as filterable by the data source if that data source supports adhoc filtering
                // (eg. Prom or Loki) and the field types support adhoc filtering (eg. string or number - depending on the data source).
                // Fields may later be marked as not filterable. For example, fields created from Grafana Transforms that
                // are derived from a data source, but are not present in the data source.
                // We choose `xField` here because it contains the label-value pair, rather than `field` which is the numeric Value.
                if (
                  config.featureToggles.adhocFiltersInTooltips &&
                  xField.config.filterable &&
                  onAddAdHocFilter != null
                ) {
                  const adHocFilterItem: AdHocFilterItem = {
                    key: xField.name,
                    operator: FILTER_FOR_OPERATOR,
                    value: String(xField.values[dataIdx]),
                  };

                  const adHocFilters: AdHocFilterModel[] = [
                    {
                      ...adHocFilterItem,
                      onClick: () => onAddAdHocFilter(adHocFilterItem),
                    },
                  ];

                  return adHocFilters;
                }

                return [];
              }}
              render={(u, dataIdxs, seriesIdx, isPinned, dismiss, timeRange2, viaSync, dataLinks, adHocFilters) => {
                return (
                  <TimeSeriesTooltip
                    series={vizSeries[0]}
                    _rest={info._rest}
                    dataIdxs={dataIdxs}
                    seriesIdx={seriesIdx}
                    mode={options.tooltip.mode}
                    sortOrder={options.tooltip.sort}
                    isPinned={isPinned}
                    maxHeight={options.tooltip.maxHeight}
                    replaceVariables={replaceVariables}
                    dataLinks={dataLinks}
                    adHocFilters={adHocFilters}
                    hideZeros={options.tooltip.hideZeros}
                  />
                );
              }}
            />
          )}
        </UPlotChart>
      )}
    </VizLayout>
  );
};
