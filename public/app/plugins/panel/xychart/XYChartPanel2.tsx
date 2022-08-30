import React, { PureComponent } from 'react';

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

import { TooltipView } from './TooltipView';
import { XYChartOptions } from './models.gen';
import { prepData, prepScatter } from './scatter';
import { ScatterHoverEvent, ScatterSeries } from './types';

type Props = PanelProps<XYChartOptions>;
type State = {
  error?: string;
  series: ScatterSeries[];
  builder?: UPlotConfigBuilder;
  facets?: FacetedData;
  hover?: ScatterHoverEvent;
};

export class XYChartPanel2 extends PureComponent<Props, State> {
  state: State = {
    series: [],
  };

  componentDidMount() {
    this.initSeries(); // also data
  }

  componentDidUpdate(oldProps: Props) {
    const { options, data } = this.props;
    const configsChanged = options !== oldProps.options || data.structureRev !== oldProps.data.structureRev;

    if (configsChanged) {
      this.initSeries();
    } else if (data !== oldProps.data) {
      this.initFacets();
    }
  }

  scatterHoverCallback = (hover?: ScatterHoverEvent) => {
    this.setState({ hover });
  };

  getData = () => {
    return this.props.data.series;
  };

  initSeries = () => {
    const { options, data } = this.props;
    const info: State = prepScatter(options, this.getData, config.theme2, this.scatterHoverCallback);
    if (info.series.length && data.series) {
      info.facets = prepData(info, data.series);
      info.error = undefined;
    }
    this.setState(info);
  };

  initFacets = () => {
    this.setState({
      facets: prepData(this.state, this.props.data.series),
    });
  };

  renderLegend = () => {
    const { data, options } = this.props;
    const { series } = this.state;
    const items: VizLegendItem[] = [];
    const defaultFormatter = (v: any) => (v == null ? '-' : v.toFixed(1));
    const theme = config.theme2;

    for (const s of series) {
      const frame = s.frame(data.series);
      if (frame) {
        for (const item of s.legend(frame)) {
          item.getDisplayValues = () => {
            const calcs = options.legend.calcs;

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

          items.push(item);
        }
      }
    }

    if (!options.legend.showLegend) {
      return null;
    }

    return (
      <VizLayout.Legend placement={options.legend.placement} width={options.legend.width}>
        <VizLegend placement={options.legend.placement} items={items} displayMode={options.legend.displayMode} />
      </VizLayout.Legend>
    );
  };

  render() {
    const { width, height, timeRange, data, options } = this.props;
    const { error, facets, builder, hover, series } = this.state;
    if (error || !builder) {
      return (
        <div className="panel-empty">
          <p>{error}</p>
        </div>
      );
    }

    return (
      <>
        <VizLayout width={width} height={height} legend={this.renderLegend()}>
          {(vizWidth: number, vizHeight: number) => (
            // <pre style={{ width: vizWidth, height: vizHeight, border: '1px solid green', margin: '0px' }}>
            //   {JSON.stringify(scatterData, null, 2)}
            // </pre>
            <UPlotChart config={builder} data={facets!} width={vizWidth} height={vizHeight} timeRange={timeRange}>
              {/*children ? children(config, alignedFrame) : null*/}
            </UPlotChart>
          )}
        </VizLayout>
        <Portal>
          {hover && options.tooltip.mode !== TooltipDisplayMode.None && (
            <VizTooltipContainer position={{ x: hover.pageX, y: hover.pageY }} offset={{ x: 10, y: 10 }}>
              <TooltipView
                options={options.tooltip}
                allSeries={series}
                rowIndex={hover.xIndex}
                hoveredPointIndex={hover.scatterIndex}
                data={data.series}
              />
            </VizTooltipContainer>
          )}
        </Portal>
      </>
    );
  }
}
