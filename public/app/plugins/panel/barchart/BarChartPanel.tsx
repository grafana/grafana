import React, { useMemo, useRef, useState } from 'react';

import {
  CartesianCoords2D,
  compareDataFrameStructures,
  DataFrame,
  Field,
  FieldColorModeId,
  FieldType,
  getFieldDisplayName,
  PanelProps,
  TimeRange,
  VizOrientation,
} from '@grafana/data';
import { PanelDataErrorView } from '@grafana/runtime';
import { SortOrder } from '@grafana/schema';
import {
  GraphGradientMode,
  GraphNG,
  GraphNGProps,
  measureText,
  PlotLegend,
  Portal,
  StackingMode,
  TooltipDisplayMode,
  UPlotConfigBuilder,
  UPLOT_AXIS_FONT_SIZE,
  usePanelContext,
  useTheme2,
  VizLayout,
  VizLegend,
  VizTooltipContainer,
} from '@grafana/ui';
import { PropDiffFn } from '@grafana/ui/src/components/GraphNG/GraphNG';
import { HoverEvent, addTooltipSupport } from '@grafana/ui/src/components/uPlot/config/addTooltipSupport';
import { CloseButton } from 'app/core/components/CloseButton/CloseButton';
import { getFieldLegendItem } from 'app/core/components/TimelineChart/utils';

import { DataHoverView } from '../geomap/components/DataHoverView';

import { PanelOptions } from './panelcfg.gen';
import { prepareBarChartDisplayValues, preparePlotConfigBuilder } from './utils';

const TOOLTIP_OFFSET = 10;

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

export const BarChartPanel = ({ data, options, fieldConfig, width, height, timeZone, id }: Props) => {
  const theme = useTheme2();
  const { eventBus } = usePanelContext();

  const oldConfig = useRef<UPlotConfigBuilder | undefined>(undefined);
  const isToolTipOpen = useRef<boolean>(false);

  const [hover, setHover] = useState<HoverEvent | undefined>(undefined);
  const [coords, setCoords] = useState<{ viewport: CartesianCoords2D; canvas: CartesianCoords2D } | null>(null);
  const [focusedSeriesIdx, setFocusedSeriesIdx] = useState<number | null>(null);
  const [focusedPointIdx, setFocusedPointIdx] = useState<number | null>(null);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [shouldDisplayCloseButton, setShouldDisplayCloseButton] = useState<boolean>(false);

  const onCloseToolTip = () => {
    isToolTipOpen.current = false;
    setCoords(null);
    setShouldDisplayCloseButton(false);
  };

  const onUPlotClick = () => {
    isToolTipOpen.current = !isToolTipOpen.current;

    // Linking into useState required to re-render tooltip
    setShouldDisplayCloseButton(isToolTipOpen.current);
  };

  const frame0Ref = useRef<DataFrame>();
  const colorByFieldRef = useRef<Field>();

  const info = useMemo(() => prepareBarChartDisplayValues(data?.series, theme, options), [data, theme, options]);
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

  const renderTooltip = (alignedFrame: DataFrame, seriesIdx: number | null, datapointIdx: number | null) => {
    const field = seriesIdx == null ? null : alignedFrame.fields[seriesIdx];
    if (field) {
      const disp = getFieldDisplayName(field, alignedFrame);
      seriesIdx = info.aligned.fields.findIndex((f) => disp === getFieldDisplayName(f, info.aligned));
    }
    const tooltipMode =
      options.fullHighlight && options.stacking !== StackingMode.None ? TooltipDisplayMode.Multi : options.tooltip.mode;

    const tooltipSort = options.tooltip.mode === TooltipDisplayMode.Multi ? options.tooltip.sort : SortOrder.None;

    return (
      <>
        {shouldDisplayCloseButton && (
          <div
            style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'flex-end',
            }}
          >
            <CloseButton
              onClick={onCloseToolTip}
              style={{
                position: 'relative',
                top: 'auto',
                right: 'auto',
                marginRight: 0,
              }}
            />
          </div>
        )}
        <DataHoverView
          data={info.aligned}
          rowIndex={datapointIdx}
          columnIndex={seriesIdx}
          sortOrder={tooltipSort}
          mode={tooltipMode}
        />
      </>
    );
  };

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
      allFrames: info.viz,
      fullHighlight,
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
    >
      {(config) => {
        if (oldConfig.current !== config) {
          oldConfig.current = addTooltipSupport({
            config,
            onUPlotClick,
            setFocusedSeriesIdx,
            setFocusedPointIdx,
            setCoords,
            setHover,
            isToolTipOpen,
            isActive,
            setIsActive,
          });
        }

        if (options.tooltip.mode === TooltipDisplayMode.None) {
          return null;
        }

        return (
          <Portal>
            {hover && coords && focusedSeriesIdx && (
              <VizTooltipContainer
                position={{ x: coords.viewport.x, y: coords.viewport.y }}
                offset={{ x: TOOLTIP_OFFSET, y: TOOLTIP_OFFSET }}
                allowPointerEvents={isToolTipOpen.current}
              >
                {renderTooltip(info.viz[0], focusedSeriesIdx, focusedPointIdx)}
              </VizTooltipContainer>
            )}
          </Portal>
        );
      }}
    </GraphNG>
  );
};
