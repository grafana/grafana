import React from 'react';
import { AlignedData } from 'uplot';
import {
  DataFrame,
  FieldMatcherID,
  fieldMatchers,
  LegacyGraphHoverClearEvent,
  LegacyGraphHoverEvent,
  TimeRange,
  TimeZone,
} from '@grafana/data';
import { Themeable2 } from '../../types';
import { UPlotConfigBuilder } from '../uPlot/config/UPlotConfigBuilder';
import { GraphNGLegendEvent, XYFieldMatchers } from './types';
import { preparePlotConfigBuilder, preparePlotFrame } from './utils';
import { findMidPointYPosition, pluginLog, preparePlotData } from '../uPlot/utils';
import { PlotLegend } from '../uPlot/PlotLegend';
import { UPlotChart } from '../uPlot/Plot';
import { LegendDisplayMode, VizLegendOptions } from '../VizLegend/models.gen';
import { VizLayout } from '../VizLayout/VizLayout';
import { withTheme2 } from '../../themes/ThemeContext';
import { PanelContext, PanelContextRoot } from '../PanelChrome/PanelContext';
import { Unsubscribable } from 'rxjs';
import { filter, throttleTime } from 'rxjs/operators';
/**
 * @internal -- not a public API
 */
export const FIXED_UNIT = '__fixed';

export interface GraphNGProps extends Themeable2 {
  data: DataFrame[];
  width: number;
  height: number;
  timeRange: TimeRange;
  legend: VizLegendOptions;
  timeZone: TimeZone;
  structureRev?: number; // a number that will change when the data[] structure changes
  fields?: XYFieldMatchers; // default will assume timeseries data
  onLegendClick?: (event: GraphNGLegendEvent) => void;
  children?: (builder: UPlotConfigBuilder, alignedDataFrame: DataFrame) => React.ReactNode;
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
  static contextType = PanelContextRoot;
  private plotInstance: React.RefObject<uPlot>;
  panelContext: PanelContext = {} as PanelContext;
  subscriptions: Unsubscribable[] = [];

  constructor(props: GraphNGProps) {
    super(props);
    this.plotInstance = React.createRef();

    pluginLog('GraphNG', false, 'constructor, data aligment');

    const alignedData = preparePlotFrame(props.data, {
      x: fieldMatchers.get(FieldMatcherID.firstTimeField).get({}),
      y: fieldMatchers.get(FieldMatcherID.numeric).get({}),
    });

    if (!alignedData) {
      return;
    }

    this.state = {
      alignedDataFrame: alignedData,
      data: preparePlotData(alignedData),
    };
  }

  componentDidMount() {
    const { alignedDataFrame } = this.state;

    this.panelContext = this.context as PanelContext;
    const { eventBus } = this.panelContext;

    const config = preparePlotConfigBuilder(
      alignedDataFrame,
      this.props.theme,
      this.getTimeRange,
      this.getTimeZone,
      eventBus
    );
    this.setState({ config });

    this.subscriptions.push(
      eventBus
        .getStream(LegacyGraphHoverEvent)
        .pipe(
          throttleTime(50),
          filter((e) => e.origin !== eventBus)
        )
        .subscribe({
          next: (evt) => {
            const u = this.plotInstance?.current;
            if (u) {
              // Try finding left position on time axis
              const left = u.valToPos(evt.payload.point.time, 'time');
              console.log(left);
              let top;
              if (left) {
                // find midpoint between points at current idx
                top = findMidPointYPosition(u, u.posToIdx(left));
              }

              if (!top || !left) {
                return;
              }

              u.setCursor({
                left,
                top,
              });
            }
          },
        })
    );

    this.subscriptions.push(
      eventBus
        .getStream(LegacyGraphHoverClearEvent)
        .pipe(
          throttleTime(50),
          filter((e) => e.origin !== eventBus)
        )
        .subscribe({
          next: (evt) => {
            const u = this.plotInstance?.current;

            if (u) {
              u.setCursor({
                left: -10,
                top: -10,
              });
            }
          },
        })
    );
  }

  componentWillUnmount() {
    for (const sub of this.subscriptions) {
      sub.unsubscribe();
    }
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
        const config = preparePlotConfigBuilder(
          alignedData,
          theme,
          this.getTimeRange,
          this.getTimeZone,
          this.panelContext.eventBus
        );

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
    const { legend, onLegendClick, data } = this.props;
    const { config } = this.state;

    if (!config || (legend && legend.displayMode === LegendDisplayMode.Hidden)) {
      return;
    }

    return (
      <PlotLegend
        data={data}
        config={config}
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
            plotRef={(u) => ((this.plotInstance as React.MutableRefObject<uPlot>).current = u)}
          >
            {children ? children(config, alignedDataFrame) : null}
          </UPlotChart>
        )}
      </VizLayout>
    );
  }
}

export const GraphNG = withTheme2(UnthemedGraphNG);
GraphNG.displayName = 'GraphNG';
