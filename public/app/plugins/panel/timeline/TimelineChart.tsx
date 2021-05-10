import React from 'react';
import { PanelContext, PanelContextRoot, UPlotConfigBuilder, GraphNG, GraphNGProps } from '@grafana/ui';
import { DataFrame, TimeRange } from '@grafana/data';
import { preparePlotConfigBuilder } from './utils';
import { BarValueVisibility, TimelineMode } from './types';

/**
 * @alpha
 */
export interface TimelineProps extends Omit<GraphNGProps, 'prepConfig' | 'propsToDiff' | 'renderLegend'> {
  mode: TimelineMode;
  rowHeight: number;
  showValue: BarValueVisibility;
  colWidth?: number;
}

const propsToDiff = ['mode', 'rowHeight', 'colWidth', 'showValue'];

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

  renderLegend = (config: UPlotConfigBuilder) => {
    return;
  };

  render() {
    return (
      <GraphNG
        {...this.props}
        prepConfig={this.prepConfig}
        propsToDiff={propsToDiff}
        renderLegend={this.renderLegend as any}
      />
    );
  }
}
