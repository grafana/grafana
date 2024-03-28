import React, { useMemo } from 'react';

import { DataFrame, PanelProps, VizOrientation } from '@grafana/data';
import { TimeZone } from '@grafana/schema';
import {
  StackingMode,
  TooltipDisplayMode,
  TooltipPlugin2,
  UPLOT_AXIS_FONT_SIZE,
  UPlotChart,
  UPlotConfigBuilder,
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

  const { dataLinkPostProcessor } = usePanelContext();
  // TODO: config data links, color field
  const info = useMemo(
    () => prepSeries(data.series, fieldConfig, stacking, theme, xField, colorByField),
    [data.series, fieldConfig, stacking, theme, xField, colorByField]
  );

  let { builder, prepData } = useMemo(
    () => {
      // prepConfig({
      //   series: series!,
      //   options,
      //   timeZone,
      //   theme,
      // }),

      console.log('invaidate!');

      return {
        builder: new UPlotConfigBuilder(),
        prepData: () => {},
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      orientation,
      timeZone,
      props.data.structureRev,

      info.series?.[0].length,

      barWidth,
      barRadius,
      showValue,
      groupWidth,
      stacking,
      legend,
      tooltip,
      text?.valueSize, // cause text itself is re-created each time?
      xTickLabelRotation,
      xTickLabelSpacing,
      fullHighlight,
      xField,
      colorByField,
      xTickLabelMaxLength, // maybe not?
      // props.fieldConfig, // usePrevious hideFrom on all fields?
    ]
  );

  // const plotData = useMemo(() => prepData(info), [prepData, series]);

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
      legend={<BarChartLegend frame={info.series![0]} options={legend} colorField={info.color} />}
    >
      {
        (vizWidth, vizHeight) => null
        // <UPlotChart config={builder!} data={data} width={vizWidth} height={vizHeight}>
        //   {props.options.tooltip.mode !== TooltipDisplayMode.None && (
        //     <TooltipPlugin2
        //       config={config}
        //       hoverMode={
        //         options.tooltip.mode === TooltipDisplayMode.Single ? TooltipHoverMode.xOne : TooltipHoverMode.xAll
        //       }
        //       render={(u, dataIdxs, seriesIdx, isPinned, dismiss, timeRange2) => {
        //         // TODO: render _rest fields that are not hideFrom.tooltip
        //         return (
        //           <TimeSeriesTooltip
        //             frames={series}
        //             seriesFrame={series![0]}
        //             dataIdxs={dataIdxs}
        //             seriesIdx={seriesIdx}
        //             mode={options.tooltip.mode}
        //             sortOrder={options.tooltip.sort}
        //             isPinned={isPinned}
        //           />
        //         );
        //       }}
        //       maxWidth={options.tooltip.maxWidth}
        //       maxHeight={options.tooltip.maxHeight}
        //     />
        //   )}
        // </UPlotChart>
      }
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

  const rawValue = (seriesIdx: number, valueIdx: number) => {
    return frame0Ref.current!.fields[seriesIdx].values[valueIdx];
  };

  // Color by value
  let getColor: ((seriesIdx: number, valueIdx: number) => string) | undefined = undefined;

  let fillOpacity = 1;

  if (info.colorByField) {
    const colorByField = info.colorByField;
    const disp = colorByField.display!;
    fillOpacity = (colorByField.config.custom.fillOpacity ?? 100) / 100;
    // gradientMode? ignore?
    getColor = (seriesIdx: number, valueIdx: number) => disp(colorByFieldRef.current?.values[valueIdx]).color!;
  } else {
    const hasPerBarColor = frame0Ref.current!.fields.some((f) => {
      const fromThresholds =
        f.config.custom?.gradientMode === GraphGradientMode.Scheme &&
        f.config.color?.mode === FieldColorModeId.Thresholds;

      return (
        fromThresholds ||
        f.config.mappings?.some((m) => {
          // ValueToText mappings have a different format, where all of them are grouped into an object keyed by value
          if (m.type === 'value') {
            // === MappingType.ValueToText
            return Object.values(m.options).some((result) => result.color != null);
          }
          return m.options.result.color != null;
        })
      );
    });

    if (hasPerBarColor) {
      // use opacity from first numeric field
      let opacityField = frame0Ref.current!.fields.find((f) => f.type === FieldType.number)!;

      fillOpacity = (opacityField.config.custom.fillOpacity ?? 100) / 100;

      getColor = (seriesIdx: number, valueIdx: number) => {
        let field = frame0Ref.current!.fields[seriesIdx];
        return field.display!(field.values[valueIdx]).color!;
      };
    }
  }
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

function prepConfig2() {

}
