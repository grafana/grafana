import React from 'react';
import { AlignedData } from 'uplot';
import { compareArrayValues, compareDataFrameStructures, DataFrame, TimeRange } from '@grafana/data';
import { VizLayout } from '../VizLayout/VizLayout';
import { Themeable } from '../../types';
import { UPlotChart } from '../uPlot/Plot';
import { UPlotConfigBuilder } from '../uPlot/config/UPlotConfigBuilder';
import { GraphNGLegendEvent } from '../GraphNG/types';
import { BarChartOptions } from './types';
import { withTheme } from '../../themes';
import { preparePlotConfigBuilder, preparePlotFrame } from './utils';
import { preparePlotData } from '../uPlot/utils';
import { LegendDisplayMode } from '../VizLegend/types';
import { PlotLegend } from '../uPlot/PlotLegend';

/**
 * @alpha
 */
export interface BarChartProps extends Themeable, BarChartOptions {
  height: number;
  width: number;
  data: DataFrame[];
  onLegendClick?: (event: GraphNGLegendEvent) => void;
  onSeriesColorChange?: (label: string, color: string) => void;
}

interface BarChartState {
  data: AlignedData;
  alignedDataFrame: DataFrame;
  config?: UPlotConfigBuilder;
}

class UnthemedBarChart extends React.Component<BarChartProps, BarChartState> {
  constructor(props: BarChartProps) {
    super(props);
    this.state = {} as BarChartState;
  }

  static getDerivedStateFromProps(props: BarChartProps, state: BarChartState) {
    const frame = preparePlotFrame(props.data);

    if (!frame) {
      return { ...state };
    }

    return {
      ...state,
      data: preparePlotData(frame),
      alignedDataFrame: frame,
    };
  }

  componentDidMount() {
    const { alignedDataFrame } = this.state;

    if (!alignedDataFrame) {
      return;
    }

    this.setState({
      config: preparePlotConfigBuilder(alignedDataFrame, this.props.theme, this.props),
    });
  }

  componentDidUpdate(prevProps: BarChartProps) {
    const { data, orientation, groupWidth, barWidth, showValue } = this.props;
    const { alignedDataFrame } = this.state;
    let shouldConfigUpdate = false;
    let hasStructureChanged = false;

    if (
      this.state.config === undefined ||
      orientation !== prevProps.orientation ||
      groupWidth !== prevProps.groupWidth ||
      barWidth !== prevProps.barWidth ||
      showValue !== prevProps.showValue
    ) {
      shouldConfigUpdate = true;
    }

    if (data !== prevProps.data) {
      if (!alignedDataFrame) {
        return;
      }
      hasStructureChanged = !compareArrayValues(data, prevProps.data, compareDataFrameStructures);
    }

    if (shouldConfigUpdate || hasStructureChanged) {
      this.setState({
        config: preparePlotConfigBuilder(alignedDataFrame, this.props.theme, this.props),
      });
    }
  }

  renderLegend() {
    const { legend, onSeriesColorChange, onLegendClick, data } = this.props;
    const { config } = this.state;

    if (!config || legend.displayMode === LegendDisplayMode.Hidden) {
      return;
    }
    return (
      <PlotLegend
        data={data}
        config={config}
        onSeriesColorChange={onSeriesColorChange}
        onLegendClick={onLegendClick}
        {...legend}
      />
    );
  }

  render() {
    const { width, height } = this.props;
    const { config, data } = this.state;

    if (!config) {
      return null;
    }

    return (
      <VizLayout width={width} height={height} legend={this.renderLegend()}>
        {(vizWidth: number, vizHeight: number) => (
          <UPlotChart
            data={data}
            config={config}
            width={vizWidth}
            height={vizHeight}
            timeRange={({ from: 1, to: 1 } as unknown) as TimeRange} // HACK
          />
        )}
      </VizLayout>
    );
  }
}

export const BarChart = withTheme(UnthemedBarChart);
BarChart.displayName = 'GraphNG';
