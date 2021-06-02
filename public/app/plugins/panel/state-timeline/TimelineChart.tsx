import React from 'react';
import {
  PanelContext,
  PanelContextRoot,
  GraphNG,
  GraphNGProps,
  BarValueVisibility,
  LegendDisplayMode,
  UPlotConfigBuilder,
  VizLayout,
  VizLegend,
  VizLegendItem,
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
  legendItems?: VizLegendItem[];
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

      // When there is only one row, use the full space
      rowHeight: alignedFrame.fields.length > 2 ? this.props.rowHeight : 1,
    });
  };

  renderLegend = (config: UPlotConfigBuilder) => {
    const { legend, legendItems } = this.props;

    if (!config || !legendItems || !legend || legend.displayMode === LegendDisplayMode.Hidden) {
      return null;
    }

    return (
      <VizLayout.Legend placement={legend.placement}>
        <VizLegend placement={legend.placement} items={legendItems} displayMode={legend.displayMode} readonly />
      </VizLayout.Legend>
    );
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
