import React from 'react';
import {
  PanelContext,
  PanelContextRoot,
  GraphNG,
  GraphNGProps,
  BarValueVisibility,
  LegendDisplayMode,
  PlotLegend,
  UPlotConfigBuilder,
} from '@grafana/ui';
import { DataFrame, FieldType, TimeRange } from '@grafana/data';
import { preparePlotConfigBuilder } from './utils';
import { TimelineMode, TimelineValueAlignment } from './types';

/**
 * @alpha
 */
export interface TimelineProps extends Omit<GraphNGProps, 'prepConfig' | 'propsToDiff' | 'renderLegend'> {
  mode: TimelineMode;
  rowHeight: number;
  showValue: BarValueVisibility;
  alignValue?: TimelineValueAlignment;
  colWidth?: number;
}

const propsToDiff = ['rowHeight', 'colWidth', 'showValue', 'mergeValues', 'alignValue'];

export class TimelineChart extends React.Component<TimelineProps> {
  static contextType = PanelContextRoot;
  panelContext: PanelContext = {} as PanelContext;

  prepConfig = (alignedFrame: DataFrame, getTimeRange: () => TimeRange) => {
    this.panelContext = this.context as PanelContext;
    const { eventBus } = this.panelContext;

    return preparePlotConfigBuilder({
      frame: alignedFrame,
      getTimeRange,
      eventBus,
      ...this.props,
    });
  };

  // renderLegend = (config: UPlotConfigBuilder) => {
  //   const { legend, frames } = this.props;

  //   if (!config || (legend && legend.displayMode === LegendDisplayMode.Hidden)) {
  //     return null;
  //   }

  //   return <PlotLegend data={frames} config={config} maxHeight="35%" maxWidth="60%" {...legend} />;
  // };

  //renderLegend = () => <div>Legend</div>;

  renderLegend = (config: UPlotConfigBuilder) => {
    const { legend, frames } = this.props;

    if (!config || (legend && legend.displayMode === LegendDisplayMode.Hidden)) {
      return null;
    }

    let stateColors = {};

    frames.forEach((frame) => {
      frame.fields.forEach((field) => {
        if (field.type !== FieldType.time) {
          field.values.toArray().forEach((v) => {
            let state = field.display!(v);
            stateColors[state.text] = state.color;
          });
        }
      });
    });

    console.log(stateColors);

    //return <PlotLegend data={frames} config={config} maxHeight="35%" maxWidth="60%" {...legend} />;

    return <div>Legend</div>;
  };

  render() {
    return (
      <GraphNG
        {...this.props}
        fields={{
          x: (f) => f.type === FieldType.time,
          y: (f) => f.type === FieldType.number || f.type === FieldType.boolean || f.type === FieldType.string,
        }}
        prepConfig={this.prepConfig}
        propsToDiff={propsToDiff}
        renderLegend={this.renderLegend}
      />
    );
  }
}
