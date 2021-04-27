import React from 'react';
import uPlot, { AlignedData } from 'uplot';
import { DashboardCursorSync, DataFrame, FieldMatcherID, fieldMatchers, TimeRange, TimeZone } from '@grafana/data';
import { withTheme } from '../../themes';
import { Themeable } from '../../types';
import { UPlotConfigBuilder } from '../uPlot/config/UPlotConfigBuilder';
import { GraphNGLegendEvent, XYFieldMatchers } from './types';
import { preparePlotConfigBuilder, preparePlotFrame } from './utils';
import { pluginLog, pluginLogger, preparePlotData } from '../uPlot/utils';
import { PlotLegend } from '../uPlot/PlotLegend';
import { UPlotChart } from '../uPlot/Plot';

import { LegendDisplayMode, VizLegendOptions } from '../VizLegend/models.gen';
import { VizLayout } from '../VizLayout/VizLayout';
import { PlotSyncConfig } from '../uPlot/context';

/**
 * @internal -- not a public API
 */
export const FIXED_UNIT = '__fixed';

function syncPubFilter(type: string, src: uPlot, x: number, y: number, w: number, h: number, dataIdx: number) {
  console.log(type);

  // emit to own or some other sync group
  //let syncKey = src.cursor.sync!.key;
  //let syncGroup = uPlot.sync(syncKey);
  //syncGroup.pub(type, src, x, y, w, h, dataIdx);

  // allow emit to src's own sync group
  return true;
}

export interface GraphNGProps extends Themeable {
  data: DataFrame[];
  width: number;
  height: number;
  timeRange: TimeRange;
  legend: VizLegendOptions;
  timeZone: TimeZone;
  structureRev?: number; // a number that will change when the data[] structure changes
  fields?: XYFieldMatchers; // default will assume timeseries data
  onLegendClick?: (event: GraphNGLegendEvent) => void;
  onSeriesColorChange?: (label: string, color: string) => void;
  children?: (builder: UPlotConfigBuilder, alignedDataFrame: DataFrame, debug?: () => boolean) => React.ReactNode;
  sync?: PlotSyncConfig | null;
}

/**
 * @internal -- not a public API
 */
export interface GraphNGState {
  alignedDataFrame: DataFrame;
  data: AlignedData;
  config?: UPlotConfigBuilder;
}

class UnthemedGraphNG extends React.Component<GraphNGProps, GraphNGState> {
  constructor(props: GraphNGProps) {
    super(props);

    pluginLog('GraphNG', false, 'constructor, data aligment');
    const alignedData = preparePlotFrame(props.data, {
      x: fieldMatchers.get(FieldMatcherID.firstTimeField).get({}),
      y: fieldMatchers.get(FieldMatcherID.numeric).get({}),
    });

    if (!alignedData) {
      return;
    }
    const config = preparePlotConfigBuilder(alignedData, props.theme, this.getTimeRange, this.getTimeZone);

    if (props.sync) {
      config.setCursor({
        sync: {
          key: props.sync.key,
          setSeries: props.sync.sync === DashboardCursorSync.Tooltip,
          filters: {
            pub: syncPubFilter,
          },
        },
      });
    }
    this.state = {
      alignedDataFrame: alignedData,
      data: preparePlotData(alignedData),
      config,
    };
  }

  componentDidUpdate(prevProps: GraphNGProps) {
    const { theme, structureRev, data } = this.props;
    let shouldConfigUpdate = false;
    let stateUpdate = {} as GraphNGState;

    if (this.state.config === undefined || this.props.timeZone !== prevProps.timeZone) {
      shouldConfigUpdate = true;
    }

    if (data !== prevProps.data) {
      pluginLog('GraphNG', false, 'data changed');
      const hasStructureChanged = structureRev !== prevProps.structureRev || !structureRev;

      if (hasStructureChanged) {
        pluginLog('GraphNG', false, 'schema changed');
      }

      pluginLog('GraphNG', false, 'componentDidUpdate, data aligment');
      const alignedData = preparePlotFrame(data, {
        x: fieldMatchers.get(FieldMatcherID.firstTimeField).get({}),
        y: fieldMatchers.get(FieldMatcherID.numeric).get({}),
      });

      if (!alignedData) {
        return;
      }

      stateUpdate = {
        alignedDataFrame: alignedData,
        data: preparePlotData(alignedData),
      };

      if (shouldConfigUpdate || hasStructureChanged) {
        pluginLog('GraphNG', false, 'updating config');
        const config = preparePlotConfigBuilder(alignedData, theme, this.getTimeRange, this.getTimeZone);
        if (this.props.sync) {
          config.setCursor({
            sync: {
              key: this.props.sync.key,
              setSeries: this.props.sync.sync === DashboardCursorSync.Tooltip,
              filters: {
                pub: syncPubFilter,
              },
            },
          });
        }
        stateUpdate = { ...stateUpdate, config };
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
    const { config, alignedDataFrame } = this.state;
    if (!config) {
      return null;
    }
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
            {children ? children(config, alignedDataFrame, pluginLogger.isEnabled) : null}
          </UPlotChart>
        )}
      </VizLayout>
    );
  }
}

export const GraphNG = withTheme(UnthemedGraphNG);
GraphNG.displayName = 'GraphNG';
