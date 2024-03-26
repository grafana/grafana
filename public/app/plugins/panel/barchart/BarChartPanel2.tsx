import { css } from '@emotion/css';
import React, { useMemo } from 'react';

import { FieldColorModeId, PanelProps, VizOrientation } from '@grafana/data';
import { config } from '@grafana/runtime';
import {
  TooltipDisplayMode,
  TooltipPlugin2,
  UPLOT_AXIS_FONT_SIZE,
  UPlotChart,
  VizLayout,
  VizLegend,
  VizLegendItem,
  measureText,
  usePanelContext,
  useStyles2,
  useTheme2,
} from '@grafana/ui';
import { TooltipHoverMode } from '@grafana/ui/src/components/uPlot/plugins/TooltipPlugin2';
import { GraphNGProps, PropDiffFn } from 'app/core/components/GraphNG/GraphNG';

import { TimeSeriesTooltip } from '../timeseries/TimeSeriesTooltip';

import { Options } from './panelcfg.gen';
import { prepSeries } from './utils2';

/**
 * @alpha
 */
export interface BarChartProps
  extends Options,
    Omit<GraphNGProps, 'prepConfig' | 'propsToDiff' | 'renderLegend' | 'theme'> {}

const propsToDiff: Array<string | PropDiffFn> = [
  'orientation',
  'barWidth',
  'barRadius',
  'xTickLabelRotation',
  'xTickLabelMaxLength',
  'xTickLabelSpacing',
  'groupWidth',
  'stacking',
  'showValue',
  'xField',
  'colorField',
  'legend',
  (prev: BarChartProps, next: BarChartProps) => next.text?.valueSize === prev.text?.valueSize,
];

interface Props extends PanelProps<Options> {}

const charWidth = measureText('M', UPLOT_AXIS_FONT_SIZE).width;
const toRads = Math.PI / 180;

export const BarChartPanel = (props: Props) => {
  const { data, options, fieldConfig, width, height, timeZone, id, replaceVariables } = props;

  const theme = useTheme2();
  const styles = useStyles2(getStyles);

  const { palette, getColorByName } = config.theme2.visualization;
  const { dataLinkPostProcessor } = usePanelContext();

  const { series, _rest, color } = useMemo(
    () => prepSeries(data.series, fieldConfig, options.stacking, theme, options.xField, options.colorByField),
    [data.series, fieldConfig, options.stacking, theme, options.xField, options.colorByField]
  );

  // size-dependent, calculated opts that should cause viz re-config
  const orientation =
    options.orientation === VizOrientation.Auto
      ? width < height
        ? VizOrientation.Horizontal
        : VizOrientation.Vertical
      : options.orientation;

  // TODO: this can be moved into axis calc internally, no need to re-config based on this
  const xTickLabelMaxLength =
    options.xTickLabelRotation === 0
      ? Infinity // should this calc using spacing between groups?
      : options.xTickLabelMaxLength ||
        // auto max length clams at half vis height, subracts 3 chars for ... ellipsis
        height / 2 / Math.sin(Math.abs(options.xTickLabelRotation * toRads)) / charWidth - 3;

  let { builder, prepData } = useMemo(
    () => {
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
      } = options;

      return preparePlotConfigBuilder({
        frame: alignedFrame,
        getTimeRange,
        timeZone,
        theme,
        timeZones: [timeZone],
        orientation,
        barWidth,
        barRadius,
        showValue,
        groupWidth,
        xTickLabelRotation,
        xTickLabelMaxLength,
        xTickLabelSpacing,
        stacking,
        legend,
        tooltip,
        text,
        rawValue,
        getColor,
        fillOpacity,
        allFrames: info.viz,
        fullHighlight,
        hoverMulti: tooltip.mode === TooltipDisplayMode.Multi,
      });
      //builder: preparePlotConfigBuilder(series, theme),
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      props.data.structureRev,
      // props.fieldConfig, // usePrevious hideFrom on all fields?
      options.barWidth,
      options.barRadius,
      options.showValue,
      options.groupWidth,
      options.stacking,
      options.legend,
      options.tooltip,
      options.text,
      options.xTickLabelRotation,
      options.xTickLabelSpacing,
      options.fullHighlight,
    ]
  );

  // console.log({
  //   height,
  //   xTickLabelRotation: options.xTickLabelRotation,
  //   xTickLabelMaxLength: options.xTickLabelMaxLength,
  //   series,
  //   _rest,
  //   color,
  // });

  // config data links, color field, hook up propsToDiff

  // TODO: React.memo()
  const renderLegend = () => {
    const items: VizLegendItem[] = [];

    // or single frame + single series + color by value?
    if (color != null) {
      return null;
    } else {
      let fields = series![0].fields;

      let paletteIdx = 0;

      for (let i = 1; i < fields.length; i++) {
        let yField = fields[i];

        if (!yField.config.custom.hideFrom?.legend) {
          let colorCfg = yField.config.color ?? { mode: FieldColorModeId.PaletteClassic };
          let name = yField.state?.displayName ?? yField.name;

          let color: string;

          if (colorCfg.mode === FieldColorModeId.PaletteClassic) {
            color = getColorByName(palette[paletteIdx++ % palette.length]); // todo: do this via state.seriesIdx and re-init displayProcessor
          } else if (colorCfg.mode === FieldColorModeId.Fixed) {
            color = getColorByName(colorCfg.fixedColor!);
          }

          items.push({
            yAxis: 1, // TODO: pull from y field
            label: name,
            color: color!,
            getItemKey: () => `${i}-${name}`,
            disabled: yField.state?.hideFrom?.viz ?? false,
          });
        }
      }
    }

    // sort series by calcs? table mode?

    const { placement, displayMode, width } = props.options.legend;

    return (
      <VizLayout.Legend placement={placement} width={width}>
        <VizLegend className={styles.legend} placement={placement} items={items} displayMode={displayMode} />
      </VizLayout.Legend>
    );
  };

  // if (error) {
  //   return (
  //     <div className="panel-empty">
  //       <p>{error}</p>
  //     </div>
  //   );
  // }

  return (
    <VizLayout width={props.width} height={props.height} legend={renderLegend()}>
      {(vizWidth: number, vizHeight: number) => (
        <UPlotChart config={builder!} data={data} width={vizWidth} height={vizHeight}>
          {props.options.tooltip.mode !== TooltipDisplayMode.None && (
            <TooltipPlugin2
              config={config}
              hoverMode={
                options.tooltip.mode === TooltipDisplayMode.Single ? TooltipHoverMode.xOne : TooltipHoverMode.xAll
              }
              render={(u, dataIdxs, seriesIdx, isPinned, dismiss, timeRange2) => {
                // TODO: render _rest fields that are not hideFrom.tooltip
                return (
                  <TimeSeriesTooltip
                    frames={series}
                    seriesFrame={series![0]}
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

  const prepConfig = (alignedFrame: DataFrame, allFrames: DataFrame[], getTimeRange: () => TimeRange) => {
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
    } = options;

    return preparePlotConfigBuilder({
      frame: alignedFrame,
      getTimeRange,
      timeZone,
      theme,
      timeZones: [timeZone],
      orientation,
      barWidth,
      barRadius,
      showValue,
      groupWidth,
      xTickLabelRotation,
      xTickLabelMaxLength,
      xTickLabelSpacing,
      stacking,
      legend,
      tooltip,
      text,
      rawValue,
      getColor,
      fillOpacity,
      allFrames: info.viz,
      fullHighlight,
      hoverMulti: tooltip.mode === TooltipDisplayMode.Multi,
    });
  };

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

const getStyles = () => ({
  legend: css({
    div: {
      justifyContent: 'flex-start',
    },
  }),
});
