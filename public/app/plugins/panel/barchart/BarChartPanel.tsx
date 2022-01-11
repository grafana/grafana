import React, { useMemo, useRef } from 'react';
import { TooltipDisplayMode, StackingMode, LegendDisplayMode } from '@grafana/schema';
import {
  compareDataFrameStructures,
  DataFrame,
  getFieldDisplayName,
  PanelProps,
  TimeRange,
  VizOrientation,
} from '@grafana/data';
import {
  GraphNG,
  GraphNGProps,
  measureText,
  PlotLegend,
  TooltipPlugin,
  UPlotConfigBuilder,
  UPLOT_AXIS_FONT_SIZE,
  usePanelContext,
  useTheme2,
  VizLayout,
  VizLegend,
} from '@grafana/ui';
import { PanelOptions } from './models.gen';
import { prepareBarChartDisplayValues, preparePlotConfigBuilder } from './utils';
import { PanelDataErrorView } from '@grafana/runtime';
import { DataHoverView } from '../geomap/components/DataHoverView';
import { getFieldLegendItem } from '../state-timeline/utils';
import { PropDiffFn } from '@grafana/ui/src/components/GraphNG/GraphNG';

/**
 * @alpha
 */
export interface BarChartProps
  extends PanelOptions,
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

interface Props extends PanelProps<PanelOptions> {}

export const BarChartPanel: React.FunctionComponent<Props> = ({ data, options, width, height, timeZone, id }) => {
  const theme = useTheme2();
  const { eventBus } = usePanelContext();

  const frame0Ref = useRef<DataFrame>();
  const info = useMemo(() => prepareBarChartDisplayValues(data?.series, theme, options), [data, theme, options]);
  const structureRef = useRef(10000);
  useMemo(() => {
    structureRef.current++;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options]); // change every time the options object changes (while editing)

  const structureRev = useMemo(() => {
    const f0 = info.viz;
    const f1 = frame0Ref.current;
    if (!(f0 && f1 && compareDataFrameStructures(f0, f1, true))) {
      structureRef.current++;
    }
    frame0Ref.current = f0;
    return (data.structureRev ?? 0) + structureRef.current;
  }, [info, data.structureRev]);

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
      const textSize = measureText('M', UPLOT_AXIS_FONT_SIZE).width; // M is usually the widest character so let's use that as an aproximation.
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

  // Force 'multi' tooltip setting or stacking mode
  const tooltip = useMemo(() => {
    if (options.stacking === StackingMode.Normal || options.stacking === StackingMode.Percent) {
      return { ...options.tooltip, mode: TooltipDisplayMode.Multi };
    }
    return options.tooltip;
  }, [options.tooltip, options.stacking]);

  if (!info.viz?.fields.length) {
    return <PanelDataErrorView panelId={id} data={data} message={info.warn} needsNumberField={true} />;
  }

  const renderTooltip = (alignedFrame: DataFrame, seriesIdx: number | null, datapointIdx: number | null) => {
    const field = seriesIdx == null ? null : alignedFrame.fields[seriesIdx];
    if (field) {
      const disp = getFieldDisplayName(field, alignedFrame);
      seriesIdx = info.aligned.fields.findIndex((f) => disp === getFieldDisplayName(f, info.aligned));
    }

    return (
      <DataHoverView
        data={info.aligned}
        rowIndex={datapointIdx}
        columnIndex={seriesIdx}
        sortOrder={options.tooltip.sort}
      />
    );
  };

  const renderLegend = (config: UPlotConfigBuilder) => {
    const { legend } = options;
    if (!config || legend.displayMode === LegendDisplayMode.Hidden) {
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

    return <PlotLegend data={[info.viz]} config={config} maxHeight="35%" maxWidth="60%" {...options.legend} />;
  };

  const rawValue = (seriesIdx: number, valueIdx: number) => {
    return frame0Ref.current!.fields[seriesIdx].values.get(valueIdx);
  };

  // Color by value
  let getColor: ((seriesIdx: number, valueIdx: number) => string) | undefined = undefined;

  let fillOpacity = 1;

  if (info.colorByField) {
    const colorByField = info.colorByField;
    const disp = colorByField.display!;
    fillOpacity = (colorByField.config.custom.fillOpacity ?? 100) / 100;
    // gradientMode? ignore?
    getColor = (seriesIdx: number, valueIdx: number) => disp(colorByField.values.get(valueIdx)).color!;
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
    } = options;

    return preparePlotConfigBuilder({
      frame: alignedFrame,
      getTimeRange,
      theme,
      timeZone,
      eventBus,
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
      allFrames: [info.viz],
    });
  };

  return (
    <GraphNG
      theme={theme}
      frames={[info.viz]}
      prepConfig={prepConfig}
      propsToDiff={propsToDiff}
      preparePlotFrame={(f) => f[0]} // already processed in by the panel above!
      renderLegend={renderLegend}
      legend={options.legend}
      timeZone={timeZone}
      timeRange={({ from: 1, to: 1 } as unknown) as TimeRange} // HACK
      structureRev={structureRev}
      width={width}
      height={height}
    >
      {(config, alignedFrame) => {
        return (
          <TooltipPlugin
            data={alignedFrame}
            config={config}
            mode={tooltip.mode}
            timeZone={timeZone}
            renderTooltip={renderTooltip}
          />
        );
      }}
    </GraphNG>
  );
};
