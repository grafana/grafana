import React from 'react';
import { AlignedData } from 'uplot';
import { DataFrame, TimeRange } from '@grafana/data';
import { VizLayout } from '../VizLayout/VizLayout';
import { Themeable2 } from '../../types';
import { UPlotChart } from '../uPlot/Plot';
import { UPlotConfigBuilder } from '../uPlot/config/UPlotConfigBuilder';
import { GraphNGLegendEvent } from '../GraphNG/types';
import { BarChartOptions } from './types';
import { withTheme2 } from '../../themes/ThemeContext';
import { preparePlotConfigBuilder, preparePlotFrame } from './utils';
import { pluginLog, preparePlotData } from '../uPlot/utils';
import { LegendDisplayMode } from '../VizLegend/models.gen';
import { PlotLegend } from '../uPlot/PlotLegend';

/**
 * @alpha
 */
export interface BarChartProps extends Themeable2, BarChartOptions {
  height: number;
  width: number;
  data: DataFrame[];
  structureRev?: number; // a number that will change when the data[] structure changes
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
    const alignedDataFrame = preparePlotFrame(props.data);
    if (!alignedDataFrame) {
      return;
    }
    const data = preparePlotData(alignedDataFrame);
    const config = preparePlotConfigBuilder(alignedDataFrame, this.props.theme, this.props);
    this.state = {
      alignedDataFrame,
      data,
      config,
    };
  }

  componentDidUpdate(prevProps: BarChartProps) {
    const { data, orientation, groupWidth, barWidth, showValue, structureRev } = this.props;
    const { alignedDataFrame } = this.state;
    let shouldConfigUpdate = false;
    let stateUpdate = {} as BarChartState;

    if (
      this.state.config === undefined ||
      orientation !== prevProps.orientation ||
      groupWidth !== prevProps.groupWidth ||
      barWidth !== prevProps.barWidth ||
      showValue !== prevProps.showValue
    ) {
      shouldConfigUpdate = true;
    }

    if (data !== prevProps.data || shouldConfigUpdate) {
      const hasStructureChanged = structureRev !== prevProps.structureRev || !structureRev;
      const alignedData = preparePlotFrame(data);

      if (!alignedData) {
        return;
      }
      stateUpdate = {
        alignedDataFrame: alignedData,
        data: preparePlotData(alignedData),
      };
      if (shouldConfigUpdate || hasStructureChanged) {
        pluginLog('BarChart', false, 'updating config');
        const builder = preparePlotConfigBuilder(alignedDataFrame, this.props.theme, this.props);
        stateUpdate = { ...stateUpdate, config: builder };
      }
    }

    if (Object.keys(stateUpdate).length > 0) {
      this.setState(stateUpdate);
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
        maxHeight="35%"
        maxWidth="60%"
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

export const BarChart = withTheme2(UnthemedBarChart);
BarChart.displayName = 'GraphNG';
