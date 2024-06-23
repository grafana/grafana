import React from 'react';

import { DataFrame, FALLBACK_COLOR, FieldType, TimeRange } from '@grafana/data';
import { VisibilityMode, TimelineValueAlignment, TooltipDisplayMode, VizTooltipOptions } from '@grafana/schema';
import { Pagination, UPlotConfigBuilder, VizLayout, VizLegend, VizLegendItem } from '@grafana/ui';

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
  maxPageSize?: number;
}

interface TimelineState {
  currentPageNumber: number;
}

const propsToDiff = [
  'rowHeight',
  'colWidth',
  'showValue',
  'mergeValues',
  'alignValue',
  'tooltip',
  'currentPageNumber',
  'maxPageSize',
];

export class TimelineChart extends React.Component<TimelineProps, TimelineState> {
  constructor(props: TimelineProps) {
    super(props);
    // TODO kputera: Test what happens if data is empty. Is 1 correct?
    this.state = { currentPageNumber: 1 };
  }

  getValueColor = (allFrames: DataFrame[], frameIdx: number, fieldIdx: number, value: unknown) => {
    const field = allFrames[frameIdx].fields[fieldIdx];

    if (field.display) {
      const disp = field.display(value); // will apply color modes
      if (disp.color) {
        return disp.color;
      }
    }

    return FALLBACK_COLOR;
  };

  prepConfig = (alignedFrame: DataFrame, allFrames: DataFrame[], getTimeRange: () => TimeRange) => {
    // TODO kputera: Is splitting frame sufficient? Will e.g. data links carry over?
    return preparePlotConfigBuilder({
      frame: alignedFrame,
      getTimeRange,
      allFrames,
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
    // TODO kputera: What happens when there is one big query instead of many singular queries?

    let props: TimelineProps & { currentPageNumber?: number } = this.props;
    let paginationEl = undefined;

    if (this.props.maxPageSize !== undefined && this.props.maxPageSize > 0) {
      const pageCount = Math.ceil(this.props.frames.length / this.props.maxPageSize);
      const pageOffset = (this.state.currentPageNumber - 1) * this.props.maxPageSize;
      const framesInCurrentPage = this.props.frames.slice(pageOffset, pageOffset + this.props.maxPageSize);
      props = {
        ...props,
        currentPageNumber: this.state.currentPageNumber,
        frames: framesInCurrentPage,
      };
      paginationEl = (
        <Pagination
          currentPage={this.state.currentPageNumber}
          numberOfPages={pageCount}
          // TODO kputera: Should we make [showSmallVersion] be dynamic?
          showSmallVersion={false}
          onNavigate={(currentPageNumber) => this.setState({ currentPageNumber })}
        />
      );
    }

    return (
      // TODO kputera: Change this to use emotion or whatever that is, rather than hardcoding the style
      // TODO kputera: Don't hardcode pagination element height. Find a way to make it better.
      <div
        style={{
          height: this.props.height,
          width: this.props.width,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          overflow: 'auto',
        }}
      >
        <GraphNG
          {...props}
          height={this.props.height - 40}
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
        />
        {paginationEl}
      </div>
    );
  }
}
