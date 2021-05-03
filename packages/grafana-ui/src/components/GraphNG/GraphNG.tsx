import React from 'react';
import { AlignedData } from 'uplot';
import { DataFrame, DataHoverEvent, FieldMatcherID, fieldMatchers, TimeRange, TimeZone } from '@grafana/data';
import { Themeable2 } from '../../types';
import { UPlotConfigBuilder } from '../uPlot/config/UPlotConfigBuilder';
import { GraphNGLegendEvent, XYFieldMatchers } from './types';
import { preparePlotConfigBuilder, preparePlotFrame } from './utils';
import { pluginLog, preparePlotData } from '../uPlot/utils';
import { PlotLegend } from '../uPlot/PlotLegend';
import { UPlotChart } from '../uPlot/Plot';
import { LegendDisplayMode, VizLegendOptions } from '../VizLegend/models.gen';
import { VizLayout } from '../VizLayout/VizLayout';
import { withTheme2 } from '../../themes/ThemeContext';
import { PanelContext, PanelContextRoot } from '../PanelChrome/PanelContext';
import { Unsubscribable } from 'rxjs';

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
  panelContext: PanelContext = {} as PanelContext;
  subscriptions: Unsubscribable[] = [];

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

    this.state = {
      alignedDataFrame: alignedData,
      data: preparePlotData(alignedData),
    };
  }

  componentDidMount() {
    const { alignedDataFrame } = this.state;

    this.panelContext = this.context as PanelContext;
    console.log('PANEL Context', this.panelContext);
    const { eventBus } = this.panelContext;

    const config = preparePlotConfigBuilder(
      alignedDataFrame,
      this.props.theme,
      this.getTimeRange,
      this.getTimeZone,
      eventBus
    );
    this.setState({ config });

    // Something like this will be required to get external events *into* uPlot...
    this.subscriptions.push(
      eventBus.subscribe(DataHoverEvent, (evt) => {
        if (evt.origin === eventBus) {
          console.log('skip self?');
          return;
        }

        const scales = this.state.config?.scaleKeys;
        if (scales) {
          const x = evt.payload.point[scales[0]];
          const y = evt.payload.point[scales[1]];

          // const pX = (x==null) ? -10 : client.valToPos(x, scales[0]);
          console.log('DataHoverEvent //', x, y);
        }
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
