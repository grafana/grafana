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

  renderLegend = (config: UPlotConfigBuilder) => {
    const { legend, frames } = this.props;

    if (!config || (legend && legend.displayMode === LegendDisplayMode.Hidden)) {
      return null;
    }

    let stateColors: Map<string, string | undefined> = new Map();

    frames.forEach((frame) => {
      frame.fields.forEach((field) => {
        if (field.type !== FieldType.time) {
          field.values.toArray().forEach((v) => {
            let state = field.display!(v);
            stateColors.set(state.text, state.color!);
          });
        }
      });
    });

    let items: VizLegendItem[] = [];

    stateColors.forEach((color, label) => {
      if (label.length > 0) {
        items.push({
          //getItemKey?: () => string;
          label: label!,
          color,
          yAxis: 1,
          // disabled?: boolean;
          // displayValues?: DisplayValue[];
          //getDisplayValues?: () => DisplayValue[];
          //fieldIndex?: DataFrameFieldIndex;
          //data?: T;
        });
      }
    });

    return (
      <VizLayout.Legend placement={legend.placement}>
        <VizLegend placement={legend.placement} items={items} displayMode={legend.displayMode} />
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
