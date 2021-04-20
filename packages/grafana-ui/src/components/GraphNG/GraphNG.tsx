import React from 'react';
import { AlignedData } from 'uplot';
import { DataFrame, DataFrameFieldIndex, FieldMatcherID, fieldMatchers, TimeRange, TimeZone } from '@grafana/data';
import { withTheme } from '../../themes';
import { Themeable } from '../../types';
import { UPlotConfigBuilder } from '../uPlot/config/UPlotConfigBuilder';
import { GraphNGLegendEvent, XYFieldMatchers } from './types';
import { GraphNGContext } from './hooks';
import { preparePlotConfigBuilder, preparePlotFrame } from './utils';
import { preparePlotData } from '../uPlot/utils';
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
  structureRev?: number; // a number that will change when the data[] structure changes
  resultRev?: number;
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
  data?: AlignedData;
  alignedDataFrame?: DataFrame;
  seriesToDataFrameFieldIndexMap?: DataFrameFieldIndex[];
  config?: UPlotConfigBuilder;
  dimFields: XYFieldMatchers;
}

class UnthemedGraphNG extends React.Component<GraphNGProps, GraphNGState> {
  constructor(props: GraphNGProps) {
    super(props);

    let dimFields = props.fields;

    if (!dimFields) {
      dimFields = {
        x: fieldMatchers.get(FieldMatcherID.firstTimeField).get({}),
        y: fieldMatchers.get(FieldMatcherID.numeric).get({}),
      };
    }

    const alignedDataFrame = preparePlotFrame(props.data, dimFields);
    const data = alignedDataFrame && preparePlotData(alignedDataFrame);

    this.state = {
      dimFields,
      alignedDataFrame,
      data,
      seriesToDataFrameFieldIndexMap: alignedDataFrame?.fields.map((f) => f.state!.origin!),
      config:
        alignedDataFrame &&
        preparePlotConfigBuilder(alignedDataFrame, props.theme, this.getTimeRange, this.getTimeZone),
    };
  }

  componentDidUpdate(prevProps: GraphNGProps) {
    const { data, theme, structureRev, resultRev } = this.props;
    let stateUpdate = {} as GraphNGState;
    let shouldConfigUpdate = this.state.config === undefined || this.props.timeZone !== prevProps.timeZone;

    if (prevProps.data !== this.props.data) {
      const alignedDataFrame = preparePlotFrame(data, this.props.fields || this.state.dimFields);
      const plotData = alignedDataFrame && preparePlotData(alignedDataFrame);
      const hasStructureChanged = structureRev !== prevProps.structureRev || !structureRev;

      let shouldDataUpdate =
        resultRev !== prevProps.resultRev || !alignedDataFrame || prevProps.fields !== this.props.fields;

      if (shouldDataUpdate) {
        if (plotData) {
          stateUpdate = {
            ...stateUpdate,
            alignedDataFrame,
            data: plotData,
          };
        }
      }

      if (shouldConfigUpdate || hasStructureChanged) {
        const builder = preparePlotConfigBuilder(
          // use either a newly aligned data if data changed, or reuse previous one
          alignedDataFrame || this.state.alignedDataFrame!,
          theme,
          this.getTimeRange,
          this.getTimeZone
        );
        stateUpdate = { ...stateUpdate, config: builder };
      }
    }

    if (Object.keys(stateUpdate).length > 0) {
      this.setState(stateUpdate);
    }
  }

  mapSeriesIndexToDataFrameFieldIndex = (i: number) => {
    return this.state.seriesToDataFrameFieldIndexMap![i];
  };

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
    const { width, height, children, timeZone, timeRange, structureRev, resultRev, ...plotProps } = this.props;

    if (!this.state.data || !this.state.config || !this.state.alignedDataFrame) {
      return null;
    }

    return (
      <GraphNGContext.Provider
        value={{
          mapSeriesIndexToDataFrameFieldIndex: this.mapSeriesIndexToDataFrameFieldIndex,
          dimFields: this.state.dimFields,
          data: this.state.alignedDataFrame,
        }}
      >
        <VizLayout width={width} height={height} legend={this.renderLegend()}>
          {(vizWidth: number, vizHeight: number) => (
            <UPlotChart
              {...plotProps}
              config={this.state.config!}
              data={this.state.data!}
              width={vizWidth}
              height={vizHeight}
              timeRange={timeRange}
            >
              {children}
            </UPlotChart>
          )}
        </VizLayout>
      </GraphNGContext.Provider>
    );
  }
}

export const GraphNG = withTheme(UnthemedGraphNG);
GraphNG.displayName = 'GraphNG';
