import { css } from '@emotion/css';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { usePrevious } from 'react-use';

import {
  DisplayProcessor,
  DisplayValue,
  fieldReducers,
  PanelProps,
  reduceField,
  ReducerID,
  getDisplayProcessor,
} from '@grafana/data';
import { config } from '@grafana/runtime';
import {
  Portal,
  TooltipDisplayMode,
  UPlotChart,
  UPlotConfigBuilder,
  VizLayout,
  VizLegend,
  VizLegendItem,
  VizTooltipContainer,
} from '@grafana/ui';
import { FacetedData } from '@grafana/ui/src/components/uPlot/types';
import { CloseButton } from 'app/core/components/CloseButton/CloseButton';

import { TooltipView } from './TooltipView';
import { SeriesMapping, XYChartOptions } from './models.gen';
import { prepData, prepScatter, ScatterPanelInfo } from './scatter';
import { ScatterHoverEvent, ScatterSeries } from './types';

type Props = PanelProps<XYChartOptions>;
const TOOLTIP_OFFSET = 10;

export const XYChartPanel2: React.FC<Props> = (props: Props) => {
  const [error, setError] = useState<string | undefined>();
  const [series, setSeries] = useState<ScatterSeries[]>([]);
  const [builder, setBuilder] = useState<UPlotConfigBuilder | undefined>();
  const [facets, setFacets] = useState<FacetedData | undefined>();
  const [hover, setHover] = useState<ScatterHoverEvent | undefined>();
  const [shouldDisplayCloseButton, setShouldDisplayCloseButton] = useState<boolean>(false);

  const isToolTipOpen = useRef<boolean>(false);
  const oldOptions = usePrevious(props.options);
  const oldData = usePrevious(props.data);

  const onCloseToolTip = () => {
    isToolTipOpen.current = false;
    setShouldDisplayCloseButton(false);
    scatterHoverCallback(undefined);
  };

  const onUPlotClick = () => {
    isToolTipOpen.current = !isToolTipOpen.current;

    // Linking into useState required to re-render tooltip
    setShouldDisplayCloseButton(isToolTipOpen.current);
  };

  const scatterHoverCallback = (hover?: ScatterHoverEvent) => {
    setHover(hover);
  };

  const initSeries = useCallback(() => {
    const getData = () => props.data.series;
    const info: ScatterPanelInfo = prepScatter(
      props.options,
      getData,
      config.theme2,
      scatterHoverCallback,
      onUPlotClick,
      isToolTipOpen
    );

    if (info.error) {
      setError(info.error);
    } else if (info.series.length && props.data.series) {
      setBuilder(info.builder);
      setSeries(info.series);
      setFacets(() => prepData(info, props.data.series));
      setError(undefined);
    }
  }, [props.data.series, props.options]);

  const initFacets = useCallback(() => {
    setFacets(() => prepData({ error, series }, props.data.series));
  }, [props.data.series, error, series]);

  useEffect(() => {
    if (oldOptions !== props.options || oldData?.structureRev !== props.data.structureRev) {
      initSeries();
    } else if (oldData !== props.data) {
      initFacets();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props]);

  const renderLegend = () => {
    const items: VizLegendItem[] = [];
    const defaultFormatter = (v: any) => (v == null ? '-' : v.toFixed(1));
    const theme = config.theme2;

    for (let si = 0; si < series.length; si++) {
      const s = series[si];
      const frame = s.frame(props.data.series);
      if (frame) {
        for (const item of s.legend()) {
          item.getDisplayValues = () => {
            const calcs = props.options.legend.calcs;

            if (!calcs?.length) {
              return [];
            }

            const field = s.y(frame);

            const fmt = field.display ?? defaultFormatter;
            let countFormatter: DisplayProcessor | null = null;

            const fieldCalcs = reduceField({
              field,
              reducers: calcs,
            });

            return calcs.map<DisplayValue>((reducerId) => {
              const fieldReducer = fieldReducers.get(reducerId);
              let formatter = fmt;

              if (fieldReducer.id === ReducerID.diffperc) {
                formatter = getDisplayProcessor({
                  field: {
                    ...field,
                    config: {
                      ...field.config,
                      unit: 'percent',
                    },
                  },
                  theme,
                });
              }

              if (
                fieldReducer.id === ReducerID.count ||
                fieldReducer.id === ReducerID.changeCount ||
                fieldReducer.id === ReducerID.distinctCount
              ) {
                if (!countFormatter) {
                  countFormatter = getDisplayProcessor({
                    field: {
                      ...field,
                      config: {
                        ...field.config,
                        unit: 'none',
                      },
                    },
                    theme,
                  });
                }
                formatter = countFormatter;
              }

              return {
                ...formatter(fieldCalcs[reducerId]),
                title: fieldReducer.name,
                description: fieldReducer.description,
              };
            });
          };

          item.disabled = !(s.show ?? true);

          if (props.options.seriesMapping === SeriesMapping.Manual) {
            item.label = props.options.series?.[si]?.name ?? `Series ${si + 1}`;
          }

          items.push(item);
        }
      }
    }

    if (!props.options.legend.showLegend) {
      return null;
    }

    const legendStyle = {
      flexStart: css`
        div {
          justify-content: flex-start !important;
        }
      `,
    };

    return (
      <VizLayout.Legend placement={props.options.legend.placement} width={props.options.legend.width}>
        <VizLegend
          className={legendStyle.flexStart}
          placement={props.options.legend.placement}
          items={items}
          displayMode={props.options.legend.displayMode}
        />
      </VizLayout.Legend>
    );
  };

  if (error || !builder || !facets) {
    return (
      <div className="panel-empty">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <>
      <VizLayout width={props.width} height={props.height} legend={renderLegend()}>
        {(vizWidth: number, vizHeight: number) => (
          <UPlotChart config={builder} data={facets} width={vizWidth} height={vizHeight} timeRange={props.timeRange} />
        )}
      </VizLayout>
      <Portal>
        {hover && props.options.tooltip.mode !== TooltipDisplayMode.None && (
          <VizTooltipContainer
            position={{ x: hover.pageX, y: hover.pageY }}
            offset={{ x: TOOLTIP_OFFSET, y: TOOLTIP_OFFSET }}
            allowPointerEvents={isToolTipOpen.current}
          >
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
            <TooltipView
              options={props.options.tooltip}
              allSeries={series}
              manualSeriesConfigs={props.options.series}
              seriesMapping={props.options.seriesMapping!}
              rowIndex={hover.xIndex}
              hoveredPointIndex={hover.scatterIndex}
              data={props.data.series}
              range={props.timeRange}
            />
          </VizTooltipContainer>
        )}
      </Portal>
    </>
  );
};
