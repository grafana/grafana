import React from 'react';
import {
  compareArrayValues,
  compareDataFrameStructures,
  DataFrame,
  FieldMatcherID,
  fieldMatchers,
  outerJoinDataFrames,
  TimeRange,
  TimeZone,
} from '@grafana/data';
import { GraphNGLegendEvent, UPlotChart, VizLayout, VizLegend, VizLegendItem, VizLegendOptions } from '..';
import { withTheme } from '../../themes';
import { Themeable } from '../../types';
import { AlignedData } from 'uplot';
import { UPlotConfigBuilder } from '../uPlot/config/UPlotConfigBuilder';
import { XYFieldMatchers } from './types';
import { isRangeEqual, mapMouseEventToMode, preparePlotConfigBuilder, preparePlotData } from './utils';

export const FIXED_UNIT = '__fixed';

export interface GraphNGProps extends Themeable {
  width: number;
  height: number;
  data: DataFrame[];
  timeRange: TimeRange;
  legend: VizLegendOptions;
  timeZone: TimeZone;
  fields?: XYFieldMatchers; // default will assume timeseries data
  onLegendClick?: (event: GraphNGLegendEvent) => void;
  onSeriesColorChange?: (label: string, color: string) => void;
  children?: React.ReactNode;
}

interface GraphNGState {
  config: UPlotConfigBuilder;
  data: AlignedData;
  dataFrame: DataFrame;
}

class UnthemedGraphNG extends React.Component<GraphNGProps, GraphNGState> {
  constructor(props: GraphNGProps) {
    super(props);
    this.state = {} as GraphNGState;
  }

  onLegendLabelClick(legend: VizLegendItem, event: React.MouseEvent) {
    const { onLegendClick } = this.props;
    const { fieldIndex } = legend;

    if (!onLegendClick || !fieldIndex) {
      return;
    }

    onLegendClick({
      fieldIndex,
      mode: mapMouseEventToMode(event),
    });
  }

  componentDidMount() {
    const { timeRange, timeZone, theme } = this.props;

    const frame = this.preparePlotFrame();

    if (!frame) {
      return;
    }
    this.setState({
      config: preparePlotConfigBuilder(frame, timeRange, timeZone, theme),
      data: preparePlotData(frame),
      dataFrame: frame,
    });
  }

  preparePlotFrame() {
    const { fields, data } = this.props;
    let dimFields = fields;

    if (!dimFields) {
      dimFields = {
        x: fieldMatchers.get(FieldMatcherID.firstTimeField).get({}),
        y: fieldMatchers.get(FieldMatcherID.numeric).get({}),
      };
    }

    return outerJoinDataFrames({
      frames: data,
      joinBy: dimFields.x,
      keep: dimFields.y,
      keepOriginIndices: true,
    });
  }

  componentDidUpdate(prevProps: GraphNGProps) {
    const { data, theme } = this.props;

    // detection of props changes that influence the config.
    // I.e. stacking option change, time range,
    let shouldConfigUpdate = false;
    let stateUpdate = {} as GraphNGState;

    if (this.state.config === undefined || !isRangeEqual(this.props.timeRange, prevProps.timeRange)) {
      shouldConfigUpdate = true;
    }

    if (this.props.data !== prevProps.data) {
      const frame = this.preparePlotFrame();
      if (!frame) {
        return;
      }

      stateUpdate = {
        data: preparePlotData(frame),
        dataFrame: frame, /// temporary to make tooltip work
      } as GraphNGState;

      const hasStructureChanged = !compareArrayValues(data, prevProps.data, compareDataFrameStructures);

      if (shouldConfigUpdate || (frame && hasStructureChanged)) {
        const builder = preparePlotConfigBuilder(frame, this.props.timeRange, this.props.timeZone, theme);
        stateUpdate = { ...stateUpdate, config: builder };
      }
    }

    if (Object.keys(stateUpdate).length > 0) {
      this.setState(stateUpdate);
    }
  }

  renderLegend() {
    const { legend, onSeriesColorChange } = this.props;

    return (
      <VizLayout.Legend position={legend.placement} maxHeight="35%" maxWidth="60%">
        <VizLegend
          onLabelClick={this.onLegendLabelClick}
          placement={legend.placement}
          items={[]}
          displayMode={legend.displayMode}
          onSeriesColorChange={onSeriesColorChange}
        />
      </VizLayout.Legend>
    );
  }

  render() {
    const { width, height, children, timeZone, timeRange, ...plotProps } = this.props;

    if (!this.state.data) {
      return null;
    }

    return (
      <VizLayout width={width} height={height} legend={this.renderLegend()}>
        {(vizWidth: number, vizHeight: number) => (
          <UPlotChart
            /// temporary to make tooltip work
            dataFrame={this.state.dataFrame}
            config={this.state.config}
            width={vizWidth}
            height={vizHeight}
            timeRange={timeRange}
            timeZone={timeZone}
            {...plotProps}
            data={this.state.data}
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
