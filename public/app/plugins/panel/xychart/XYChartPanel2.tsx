import React, { PureComponent } from 'react';
import { PanelProps } from '@grafana/data';
import { XYChartOptions } from './models.gen';
import { ScatterHoverCallback, ScatterHoverEvent, ScatterSeries } from './types';
import { LegendDisplayMode, UPlotChart, UPlotConfigBuilder, VizLayout, VizLegend, VizLegendItem } from '@grafana/ui';
import { FacetedData } from '@grafana/ui/src/components/uPlot/types';
import { prepData, prepScatter } from './scatter';
import { config } from '@grafana/runtime';

type Props = PanelProps<XYChartOptions>;
type State = {
  error?: string;
  series: ScatterSeries[];
  builder?: UPlotConfigBuilder;
  facets?: FacetedData;
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

  scatterHoverCallback = (evt: ScatterHoverEvent) => {
    console.log('SHOW TOOLTIP', { ...evt });
  };

  initSeries = () => {
    const { options, data } = this.props;
    const info: State = prepScatter(options, data, config.theme2, this.scatterHoverCallback);
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
    const { width, height, timeRange } = this.props;
    const { error, facets, builder } = this.state;
    if (error || !builder) {
      return (
        <div className="panel-empty">
          <p>{error}</p>
        </div>
      );
    }

    return (
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
    );
  }
}
