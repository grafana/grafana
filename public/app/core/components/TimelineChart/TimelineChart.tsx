import { Component } from 'react';

import { DataFrame, FALLBACK_COLOR, FieldType, TimeRange } from '@grafana/data';
import { VisibilityMode, TimelineValueAlignment, TooltipDisplayMode, VizTooltipOptions } from '@grafana/schema';
import { UPlotConfigBuilder, VizLayout, VizLegend, VizLegendItem } from '@grafana/ui';

import { GraphNG, GraphNGProps } from '../GraphNG/GraphNG';

import { preparePlotConfigBuilder, TimelineMode } from './utils';

/**
 * @alpha
 */
export interface TimelineProps extends Omit<GraphNGProps, 'prepConfig' | 'propsToDiff' | 'renderLegend'> {
  mode: TimelineMode;
  rowHeight?: number;
  showValue: VisibilityMode;
  alignValue?: TimelineValueAlignment;
  colWidth?: number;
  legendItems?: VizLegendItem[];
  tooltip?: VizTooltipOptions;
  // Whenever `paginationRev` changes, the graph will be fully re-configured/rendered.
  paginationRev?: string;
}

const propsToDiff = ['rowHeight', 'colWidth', 'showValue', 'mergeValues', 'alignValue', 'tooltip', 'paginationRev'];

export class TimelineChart extends Component<TimelineProps> {
  getValueColor = (frameIdx: number, fieldIdx: number, value: unknown) => {
    const field = this.props.frames[frameIdx]?.fields[fieldIdx];

    if (field?.display) {
      const disp = field.display(value); // will apply color modes
      if (disp.color) {
        return disp.color;
      }
    }

    return FALLBACK_COLOR;
  };

  prepConfig = (alignedFrame: DataFrame, allFrames: DataFrame[], getTimeRange: () => TimeRange) => {
    return preparePlotConfigBuilder({
      frame: alignedFrame,
      getTimeRange,
      allFrames: this.props.frames,
      ...this.props,

      // Ensure timezones is passed as an array
      timeZones: Array.isArray(this.props.timeZone) ? this.props.timeZone : [this.props.timeZone],

      // When there is only one row, use the full space
      rowHeight: alignedFrame.fields.length > 2 ? this.props.rowHeight : 1,
      getValueColor: this.getValueColor,

      hoverMulti: this.props.tooltip?.mode === TooltipDisplayMode.Multi,
    });
  };

  renderLegend = (config: UPlotConfigBuilder) => {
    const { legend, legendItems } = this.props;

    if (!config || !legendItems || !legend || legend.showLegend === false) {
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
          y: (f) =>
            f.type === FieldType.number ||
            f.type === FieldType.boolean ||
            f.type === FieldType.string ||
            f.type === FieldType.enum,
        }}
        prepConfig={this.prepConfig}
        propsToDiff={propsToDiff}
        renderLegend={this.renderLegend}
        omitHideFromViz={true}
      />
    );
  }
}
