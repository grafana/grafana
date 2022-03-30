import React, { PureComponent } from 'react';
import { PanelProps } from '@grafana/data';
import { XYChartOptions } from './models.gen';
import { ScatterHoverEvent, ScatterSeries } from './types';
import {
  LegendDisplayMode,
  Portal,
  UPlotChart,
  UPlotConfigBuilder,
  VizLayout,
  VizLegend,
  VizLegendItem,
  VizTooltipContainer,
} from '@grafana/ui';
import { FacetedData } from '@grafana/ui/src/components/uPlot/types';
import { prepData, prepScatter } from './scatter';
import { config } from '@grafana/runtime';
import { TooltipView } from './TooltipView';

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
    const { data } = this.props;
    const { series } = this.state;
    const items: VizLegendItem[] = [];
    for (const s of series) {
      const frame = s.frame(data.series);
      if (frame) {
        for (const item of s.legend(frame)) {
          items.push(item);
        }
      }
    }

    return (
      <VizLayout.Legend placement="bottom">
        <VizLegend placement="bottom" items={items} displayMode={LegendDisplayMode.List} />
      </VizLayout.Legend>
    );
  };

  render() {
    const { width, height, timeRange, data } = this.props;
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
          {hover && (
            <VizTooltipContainer position={{ x: hover.pageX, y: hover.pageY }} offset={{ x: 10, y: 10 }}>
              <TooltipView series={series[hover.scatterIndex]} rowIndex={hover.xIndex} data={data.series} />
            </VizTooltipContainer>
          )}
        </Portal>
      </>
    );
  }
}
