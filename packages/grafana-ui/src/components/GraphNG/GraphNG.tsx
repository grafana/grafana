import React from 'react';
import { AlignedData } from 'uplot';
import { DataFrame, TimeRange, TimeZone } from '@grafana/data';
import { withTheme } from '../../themes';
import { Themeable } from '../../types';
import { UPlotConfigBuilder } from '../uPlot/config/UPlotConfigBuilder';
import { GraphNGLegendEvent, XYFieldMatchers } from './types';
import { preparePlotConfigBuilder } from './utils';
import { pluginLog, preparePlotData } from '../uPlot/utils';
import { PlotLegend } from '../uPlot/PlotLegend';
import { UPlotChart } from '../uPlot/Plot';
import { LegendDisplayMode, VizLegendOptions } from '../VizLegend/models.gen';
import { VizLayout } from '../VizLayout/VizLayout';

/**
 * @internal -- not a public API
 */
export const FIXED_UNIT = '__fixed';

export interface GraphNGProps extends Themeable {
  width: number;
  height: number;
  data: DataFrame[];
  alignedData: DataFrame;
  structureRev?: number; // a number that will change when the data[] structure changes
  timeRange: TimeRange;
  legend: VizLegendOptions;
  timeZone: TimeZone;
  fields?: XYFieldMatchers; // default will assume timeseries data
  onLegendClick?: (event: GraphNGLegendEvent) => void;
  onSeriesColorChange?: (label: string, color: string) => void;
  children?: React.ReactNode;
}

/**
 * @internal -- not a public API
 */
export interface GraphNGState {
  data: AlignedData;
  config?: UPlotConfigBuilder;
}

class UnthemedGraphNG extends React.Component<GraphNGProps, GraphNGState> {
  constructor(props: GraphNGProps) {
    super(props);

    this.state = {
      data: preparePlotData(props.alignedData),
      config: preparePlotConfigBuilder(props.alignedData, props.theme, this.getTimeRange, this.getTimeZone),
    };
  }

  componentDidUpdate(prevProps: GraphNGProps) {
    const { alignedData, theme, structureRev } = this.props;
    let shouldConfigUpdate = false;
    let stateUpdate = {} as GraphNGState;

    if (this.state.config === undefined || this.props.timeZone !== prevProps.timeZone) {
      shouldConfigUpdate = true;
    }

    if (alignedData !== prevProps.alignedData) {
      pluginLog('GraphNG', false, 'data changed');
      const hasStructureChanged = structureRev !== prevProps.structureRev || !structureRev;

      if (hasStructureChanged) {
        pluginLog('GraphNG', false, 'schema changed');
      }

      stateUpdate = {
        data: preparePlotData(alignedData),
      };

      if (shouldConfigUpdate || hasStructureChanged) {
        pluginLog('GraphNG', false, 'updating config');
        const builder = preparePlotConfigBuilder(alignedData, theme, this.getTimeRange, this.getTimeZone);
        stateUpdate = { ...stateUpdate, config: builder };
      }
    }

    if (Object.keys(stateUpdate).length > 0) {
      this.setState(stateUpdate);
    }
  }

  getTimeRange = () => {
    return this.props.timeRange;
  };

  getTimeZone = () => {
    return this.props.timeZone;
  };

  renderLegend() {
    const { legend, onSeriesColorChange, onLegendClick, data } = this.props;
    const { config } = this.state;

    if (!config || (legend && legend.displayMode === LegendDisplayMode.Hidden)) {
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
    const { width, height, children, timeRange } = this.props;

    return (
      <VizLayout width={width} height={height} legend={this.renderLegend()}>
        {(vizWidth: number, vizHeight: number) => (
          <UPlotChart
            config={this.state.config!}
            data={this.state.data}
            width={vizWidth}
            height={vizHeight}
            timeRange={timeRange}
          >
            {children}
          </UPlotChart>
        )}
      </VizLayout>
    );
  }
}

export const GraphNG = withTheme(UnthemedGraphNG);
GraphNG.displayName = 'GraphNG';
