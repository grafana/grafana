import React, { useMemo } from 'react';

import { DataFrame, PanelProps, VizOrientation } from '@grafana/data';
import { TimeZone } from '@grafana/schema';
import {
  StackingMode,
  TooltipDisplayMode,
  TooltipPlugin2,
  UPLOT_AXIS_FONT_SIZE,
  UPlotChart,
  VizLayout,
  VizTextDisplayOptions,
  measureText,
  usePanelContext,
  useTheme2,
} from '@grafana/ui';
import { TooltipHoverMode } from '@grafana/ui/src/components/uPlot/plugins/TooltipPlugin2';

import { TimeSeriesTooltip } from '../timeseries/TimeSeriesTooltip';

import { BarChartLegend } from './BarChartLegend';
import { Options } from './panelcfg.gen';
import { prepConfig, prepSeries } from './utils2';

const charWidth = measureText('M', UPLOT_AXIS_FONT_SIZE).width;
const toRads = Math.PI / 180;

export const BarChartPanel = (props: PanelProps<Options>) => {
  const { data, options, fieldConfig, width, height, timeZone, id, replaceVariables } = props;
  const { dataLinkPostProcessor } = usePanelContext();

  const theme = useTheme2();

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

  // TODO: config data links, color field
  const info = useMemo(
    () => prepSeries(data.series, fieldConfig, stacking, theme, xField, colorByField),
    [data.series, fieldConfig, stacking, theme, xField, colorByField]
  );

  const xGroupsCount = info.series?.[0].length;

  let { builder, prepData } = useMemo(
    () => {
      console.log('invaidate!');

      return prepConfig({ series: info.series!, color: info.color, orientation, options, timeZone, theme });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      orientation,
      timeZone,
      props.data.structureRev,

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

  const plotData = useMemo(() => prepData(info.series!, info.color), [prepData, info.series, info.color]);

  // if (error) {
  //   return (
  //     <div className="panel-empty">
  //       <p>{error}</p>
  //     </div>
  //   );
  // }

  return (
    <VizLayout
      width={props.width}
      height={props.height}
      // legend={<BarChartLegend frame={info.series![0]} options={legend} colorField={info.color} />}
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
              render={(u, dataIdxs, seriesIdx, isPinned, dismiss, timeRange2) => {
                return (
                  <TimeSeriesTooltip
                    series={info.series![0]}
                    _rest={info._rest}
                    dataIdxs={dataIdxs}
                    seriesIdx={seriesIdx}
                    mode={options.tooltip.mode}
                    sortOrder={options.tooltip.sort}
                    isPinned={isPinned}
                    maxHeight={options.tooltip.maxHeight}
                  />
                );
              }}
            />
          )}
        </UPlotChart>
      )}
    </VizLayout>
  );

  // if ('warn' in info) {
  //   return (
  //     <PanelDataErrorView
  //       panelId={id}
  //       fieldConfig={fieldConfig}
  //       data={data}
  //       message={info.warn}
  //       needsNumberField={true}
  //     />
  //   );
  // }

  /*
  const renderLegend = (config: UPlotConfigBuilder) => {
    const { legend } = options;

    if (!config || legend.showLegend === false) {
      return null;
    }

    if (info.colorByField) {
      const items = getFieldLegendItem([info.colorByField], theme);
      if (items?.length) {
        return (
          <VizLayout.Legend placement={legend.placement}>
            <VizLegend placement={legend.placement} items={items} displayMode={legend.displayMode} />
          </VizLayout.Legend>
        );
      }
    }

    return <PlotLegend data={[info.legend]} config={config} maxHeight="35%" maxWidth="60%" {...options.legend} />;
  };




  */

  return (
    <GraphNG
      theme={theme}
      frames={info.viz}
      prepConfig={prepConfig}
      propsToDiff={propsToDiff}
      preparePlotFrame={(f) => f[0]} // already processed in by the panel above!
      renderLegend={renderLegend}
      legend={options.legend}
      timeZone={timeZone}
      timeRange={{ from: 1, to: 1 } as unknown as TimeRange} // HACK
      structureRev={structureRev}
      width={width}
      height={height}
      replaceVariables={replaceVariables}
      dataLinkPostProcessor={dataLinkPostProcessor}
    >
      {(config) => {
        if (options.tooltip.mode !== TooltipDisplayMode.None) {
          return (
            <TooltipPlugin2
              config={config}
              hoverMode={
                options.tooltip.mode === TooltipDisplayMode.Single ? TooltipHoverMode.xOne : TooltipHoverMode.xAll
              }
              render={(u, dataIdxs, seriesIdx, isPinned, dismiss, timeRange2) => {
                return (
                  <TimeSeriesTooltip
                    frames={info.viz}
                    seriesFrame={info.aligned}
                    dataIdxs={dataIdxs}
                    seriesIdx={seriesIdx}
                    mode={options.tooltip.mode}
                    sortOrder={options.tooltip.sort}
                    isPinned={isPinned}
                  />
                );
              }}
              maxWidth={options.tooltip.maxWidth}
              maxHeight={options.tooltip.maxHeight}
            />
          );
        }

        return null;
      }}
    </GraphNG>
  );
};

interface PrepConfig2Opts {
  frame: DataFrame;

  orientation: VizOrientation;
  timeZone: TimeZone;
  barWidth: number;
  barRadius: number;
  showValue: number;
  groupWidth: number;
  stacking: StackingMode;
  text: VizTextDisplayOptions;
  xTickLabelRotation: number;
  xTickLabelSpacing: number;
  fullHighlight: boolean;
  xField: string;
  colorField: string;
}

function prepConfig2() {}
