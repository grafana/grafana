import React, { createRef, useMemo, useRef, useState } from 'react';
import { TooltipDisplayMode, StackingMode, LegendDisplayMode } from '@grafana/schema';
import {
  CartesianCoords2D,
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
  Portal,
  UPlotConfigBuilder,
  UPLOT_AXIS_FONT_SIZE,
  usePanelContext,
  useTheme2,
  VizLayout,
  VizLegend,
  VizTooltipContainer,
} from '@grafana/ui';
import { PropDiffFn } from '@grafana/ui/src/components/GraphNG/GraphNG';
import { useOverlay } from '@react-aria/overlays';
import { useMountedState } from 'react-use';
import { positionTooltip } from '@grafana/ui/src/components/uPlot/plugins/TooltipPlugin';
import { PanelDataErrorView } from '@grafana/runtime';

import { PanelOptions } from './models.gen';
import { prepareBarChartDisplayValues, preparePlotConfigBuilder } from './utils';
import { DataHoverView } from '../geomap/components/DataHoverView';
import { getFieldLegendItem } from '../state-timeline/utils';

export interface HoverEvent {
  xIndex: number;
  yIndex: number;
  pageX: number;
  pageY: number;
}

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

export const BarChartPanel: React.FunctionComponent<Props> = ({ data, options, width, height, timeZone, id }) => {
  const theme = useTheme2();
  const { eventBus } = usePanelContext();

  let oldConfig = useRef<UPlotConfigBuilder | undefined>(undefined);

  const [hover, setHover] = useState<HoverEvent | undefined>(undefined);
  const [isToolTipOpen, setIsToolTipOpen] = useState<boolean>(false);
  const isMounted = useMountedState();
  const [coords, setCoords] = useState<CartesianCoords2D | null>(null);
  const [focusedSeriesIdx, setFocusedSeriesIdx] = useState<number | null>(null);
  const [focusedPointIdx, setFocusedPointIdx] = useState<number | null>(null);

  const onCloseToolTip = () => {
    setIsToolTipOpen(false);
  };
  const ref = createRef<HTMLElement>();
  const { overlayProps } = useOverlay({ onClose: onCloseToolTip, isDismissable: true, isOpen: isToolTipOpen }, ref);

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
      timeRange={{ from: 1, to: 1 } as unknown as TimeRange} // HACK
      structureRev={structureRev}
      width={width}
      height={height}
    >
      {(config, alignedFrame) => {
        if (oldConfig.current !== config) {
          let rect: DOMRect;
          // rect of .u-over (grid area)
          config.addHook('syncRect', (u, r) => {
            rect = r;
          });

          const tooltipInterpolator = config.getTooltipInterpolator();
          if (tooltipInterpolator) {
            config.addHook('setCursor', (u) => {
              tooltipInterpolator(
                setFocusedSeriesIdx,
                setFocusedPointIdx,
                (clear) => {
                  if (clear) {
                    setCoords(null);
                    return;
                  }

                  if (!rect) {
                    return;
                  }

                  const { x, y } = positionTooltip(u, rect);
                  if (x !== undefined && y !== undefined) {
                    setCoords({ x, y });
                  }
                },
                u
              );
            });
          }

          config.addHook('setLegend', (u) => {
            if (!isMounted()) {
              return;
            }
            setFocusedPointIdx(u.legend.idx!);
            if (u.cursor.idxs != null) {
              for (let i = 0; i < u.cursor.idxs.length; i++) {
                const sel = u.cursor.idxs[i];
                if (sel != null) {
                  const hover: HoverEvent = {
                    xIndex: sel,
                    yIndex: 0,
                    pageX: rect.left + u.cursor.left!,
                    pageY: rect.top + u.cursor.top!,
                  };
                  setHover(hover);

                  return; // only show the first one
                }
              }
            }

            if (!isToolTipOpen) {
              setHover(undefined);
            }
          });

          config.addHook('setSeries', (_, idx) => {
            if (!isMounted()) {
              return;
            }
            setFocusedSeriesIdx(idx);
          });

          oldConfig.current = config;
        }

        let seriesIdx = focusedSeriesIdx;
        const field = seriesIdx == null ? null : alignedFrame.fields[seriesIdx];
        if (field) {
          const disp = getFieldDisplayName(field, alignedFrame);
          seriesIdx = info.aligned.fields.findIndex((f) => disp === getFieldDisplayName(f, info.aligned));
        }

        return (
          <Portal>
            {hover && coords && (
              <VizTooltipContainer
                position={{ x: coords.x, y: coords.y }}
                offset={{ x: TOOLTIP_OFFSET, y: TOOLTIP_OFFSET }}
                allowPointerEvents
              >
                <section ref={ref} {...overlayProps}>
                  <DataHoverView
                    data={info.aligned}
                    rowIndex={focusedPointIdx}
                    columnIndex={seriesIdx}
                    sortOrder={options.tooltip.sort}
                  />
                </section>
              </VizTooltipContainer>
            )}
          </Portal>
        );
      }}
    </GraphNG>
  );
};
