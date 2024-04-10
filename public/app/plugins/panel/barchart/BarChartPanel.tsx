import React, { useMemo, useRef } from 'react';

import {
  compareDataFrameStructures,
  DataFrame,
  Field,
  FieldColorModeId,
  FieldType,
  PanelProps,
  TimeRange,
  VizOrientation,
} from '@grafana/data';
import { PanelDataErrorView } from '@grafana/runtime';
import {
  GraphGradientMode,
  measureText,
  PlotLegend,
  TooltipDisplayMode,
  UPlotConfigBuilder,
  UPLOT_AXIS_FONT_SIZE,
  usePanelContext,
  useTheme2,
  VizLayout,
  VizLegend,
  TooltipPlugin2,
} from '@grafana/ui';
import { TooltipHoverMode } from '@grafana/ui/src/components/uPlot/plugins/TooltipPlugin2';
import { GraphNG, GraphNGProps, PropDiffFn } from 'app/core/components/GraphNG/GraphNG';
import { getFieldLegendItem } from 'app/core/components/TimelineChart/utils';

import { TimeSeriesTooltip } from '../timeseries/TimeSeriesTooltip';

import { Options } from './panelcfg.gen';
import { prepareBarChartDisplayValues, preparePlotConfigBuilder } from './utils';

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

export const BarChartPanel = ({ data, options, fieldConfig, width, height, timeZone, id, replaceVariables }: Props) => {
  const theme = useTheme2();
  const { dataLinkPostProcessor } = usePanelContext();

  const frame0Ref = useRef<DataFrame>();
  const colorByFieldRef = useRef<Field>();

  const info = useMemo(() => prepareBarChartDisplayValues(data.series, theme, options), [data.series, theme, options]);
  const chartDisplay = 'viz' in info ? info : null;

  colorByFieldRef.current = chartDisplay?.colorByField;

  const structureRef = useRef(10000);

  useMemo(() => {
    structureRef.current++;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options]); // change every time the options object changes (while editing)

  const structureRev = useMemo(() => {
    const f0 = chartDisplay?.viz[0];
    const f1 = frame0Ref.current;
    if (!(f0 && f1 && compareDataFrameStructures(f0, f1, true))) {
      structureRef.current++;
    }
    frame0Ref.current = f0;
    return (data.structureRev ?? 0) + structureRef.current;
  }, [chartDisplay, data.structureRev]);

  const orientation = useMemo(() => {
    if (!options.orientation || options.orientation === VizOrientation.Auto) {
      return width < height ? VizOrientation.Horizontal : VizOrientation.Vertical;
    }
    return options.orientation;
  }, [width, height, options.orientation]);

  const xTickLabelMaxLength = useMemo(() => {
    // If no max length is set, limit the number of characters to a length where it will use a maximum of half of the height of the viz.
    if (!options.xTickLabelMaxLength) {
      const rotationAngle = options.xTickLabelRotation;
      const textSize = measureText('M', UPLOT_AXIS_FONT_SIZE).width; // M is usually the widest character so let's use that as an approximation.
      const maxHeightForValues = height / 2;

      return (
        maxHeightForValues /
          (Math.sin(((rotationAngle >= 0 ? rotationAngle : rotationAngle * -1) * Math.PI) / 180) * textSize) -
        3 //Subtract 3 for the "..." added to the end.
      );
    } else {
      return options.xTickLabelMaxLength;
    }
  }, [height, options.xTickLabelRotation, options.xTickLabelMaxLength]);

  if ('warn' in info) {
    return (
      <PanelDataErrorView
        panelId={id}
        fieldConfig={fieldConfig}
        data={data}
        message={info.warn}
        needsNumberField={true}
      />
    );
  }

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
            />
          );
        }

        return null;
      }}
    </GraphNG>
  );
};
