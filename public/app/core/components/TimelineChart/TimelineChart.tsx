import { useCallback } from 'react';

import { FALLBACK_COLOR, type TimeRange } from '@grafana/data';
import { type DataFrame, FieldType } from '@grafana/data/dataframe';
import {
  type TimelineValueAlignment,
  TooltipDisplayMode,
  type VisibilityMode,
  type VizTooltipOptions,
} from '@grafana/schema';
import { type UPlotConfigBuilder, VizLayout, VizLegend, type VizLegendItem } from '@grafana/ui';

import { GraphNG, type GraphNGProps } from '../GraphNG/GraphNG';
import { getXAxisConfig } from '../TimeSeries/utils';

import { preparePlotConfigBuilder, type TimelineMode } from './utils';

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

const propsToDiff = [
  'rowHeight',
  'colWidth',
  'showValue',
  'mergeValues',
  'alignValue',
  'tooltip',
  'paginationRev',
  'annotationLanes',
  'theme',
];

export const TimelineChart = (props: TimelineProps) => {
  const { frames, timeZone, rowHeight, tooltip, legend, legendItems } = props;

  const getValueColor = useCallback(
    (frameIdx: number, fieldIdx: number, value: unknown) => {
      const field = frames[frameIdx]?.fields[fieldIdx];

      if (field?.display) {
        const disp = field.display(value); // will apply color modes
        if (disp.color) {
          return disp.color;
        }
      }

      return FALLBACK_COLOR;
    },
    [frames]
  );

  const prepConfig = useCallback(
    (alignedFrame: DataFrame, allFrames: DataFrame[], getTimeRange: () => TimeRange) => {
      return preparePlotConfigBuilder({
        frame: alignedFrame,
        getTimeRange,
        allFrames: frames,
        ...props,

        // Ensure timezones is passed as an array
        timeZones: Array.isArray(timeZone) ? timeZone : [timeZone],

        // When there is only one row, use the full space
        rowHeight: alignedFrame.fields.length > 2 ? rowHeight : 1,
        getValueColor: getValueColor,

        hoverMulti: tooltip?.mode === TooltipDisplayMode.Multi,
        xAxisConfig: getXAxisConfig(props.annotationLanes),
      });
    },
    [frames, props, timeZone, rowHeight, getValueColor, tooltip]
  );

  const renderLegend = useCallback(
    (config: UPlotConfigBuilder) => {
      if (!config || !legendItems || !legend || legend.showLegend === false) {
        return null;
      }

      return (
        <VizLayout.Legend placement={legend.placement}>
          <VizLegend placement={legend.placement} items={legendItems} displayMode={legend.displayMode} readonly />
        </VizLayout.Legend>
      );
    },
    [legend, legendItems]
  );

  return (
    <GraphNG
      {...props}
      fields={{
        x: (f) => f.type === FieldType.time,
        y: (f) =>
          f.type === FieldType.number ||
          f.type === FieldType.boolean ||
          f.type === FieldType.string ||
          f.type === FieldType.enum,
      }}
      prepConfig={prepConfig}
      propsToDiff={propsToDiff}
      renderLegend={renderLegend}
      omitHideFromViz={true}
    />
  );
};
