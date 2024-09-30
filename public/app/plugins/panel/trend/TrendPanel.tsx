import { useMemo } from 'react';

import { DataFrame, FieldMatcherID, fieldMatchers, FieldType, PanelProps, TimeRange } from '@grafana/data';
import { isLikelyAscendingVector } from '@grafana/data/src/transformations/transformers/joinDataFrames';
import { config, PanelDataErrorView } from '@grafana/runtime';
import { KeyboardPlugin, TooltipDisplayMode, usePanelContext, TooltipPlugin2 } from '@grafana/ui';
import { TooltipHoverMode } from '@grafana/ui/src/components/uPlot/plugins/TooltipPlugin2';
import { XYFieldMatchers } from 'app/core/components/GraphNG/types';
import { preparePlotFrame } from 'app/core/components/GraphNG/utils';
import { TimeSeries } from 'app/core/components/TimeSeries/TimeSeries';
import { findFieldIndex } from 'app/features/dimensions';

import { TimeSeriesTooltip } from '../timeseries/TimeSeriesTooltip';
import { prepareGraphableFields } from '../timeseries/utils';

import { Options } from './panelcfg.gen';

export const TrendPanel = ({
  data,
  timeRange,
  timeZone,
  width,
  height,
  options,
  fieldConfig,
  replaceVariables,
  id,
}: PanelProps<Options>) => {
  const { dataLinkPostProcessor } = usePanelContext();
  // Need to fallback to first number field if no xField is set in options otherwise panel crashes 😬
  const trendXFieldName =
    options.xField ?? data.series[0].fields.find((field) => field.type === FieldType.number)?.name;

  const preparePlotFrameTimeless = (frames: DataFrame[], dimFields: XYFieldMatchers, timeRange?: TimeRange | null) => {
    dimFields = {
      ...dimFields,
      x: fieldMatchers.get(FieldMatcherID.byName).get(trendXFieldName),
    };

    return preparePlotFrame(frames, dimFields);
  };

  const info = useMemo(() => {
    if (data.series.length > 1) {
      return {
        warning: 'Only one frame is supported, consider adding a join transformation',
        frames: data.series,
      };
    }

    let frames = data.series;
    let xFieldIdx: number | undefined;
    if (options.xField) {
      xFieldIdx = findFieldIndex(options.xField, frames[0]);
      if (xFieldIdx == null) {
        return {
          warning: 'Unable to find field: ' + options.xField,
          frames: data.series,
        };
      }
    } else {
      // first number field
      // Perhaps we can/should support any ordinal rather than an error here
      xFieldIdx = frames[0].fields.findIndex((f) => f.type === FieldType.number);
      if (xFieldIdx === -1) {
        return {
          warning: 'No numeric fields found for X axis',
          frames,
        };
      }
    }

    // Make sure values are ascending
    if (xFieldIdx != null) {
      const field = frames[0].fields[xFieldIdx];
      if (field.type === FieldType.number && !isLikelyAscendingVector(field.values)) {
        return {
          warning: `Values must be in ascending order`,
          frames,
        };
      }
    }

    return { frames: prepareGraphableFields(frames, config.theme2, undefined, xFieldIdx) };
  }, [data.series, options.xField]);

  if (info.warning || !info.frames) {
    return (
      <PanelDataErrorView
        panelId={id}
        fieldConfig={fieldConfig}
        data={data}
        message={info.warning}
        needsNumberField={true}
      />
    );
  }

  return (
    <TimeSeries // Name change!
      frames={info.frames}
      structureRev={data.structureRev}
      timeRange={timeRange}
      timeZone={timeZone}
      width={width}
      height={height}
      legend={options.legend}
      options={options}
      preparePlotFrame={preparePlotFrameTimeless}
      replaceVariables={replaceVariables}
      dataLinkPostProcessor={dataLinkPostProcessor}
    >
      {(uPlotConfig, alignedDataFrame) => {
        return (
          <>
            <KeyboardPlugin config={uPlotConfig} />
            {options.tooltip.mode !== TooltipDisplayMode.None && (
              <TooltipPlugin2
                config={uPlotConfig}
                hoverMode={
                  options.tooltip.mode === TooltipDisplayMode.Single ? TooltipHoverMode.xOne : TooltipHoverMode.xAll
                }
                render={(u, dataIdxs, seriesIdx, isPinned = false) => {
                  return (
                    <TimeSeriesTooltip
                      series={alignedDataFrame}
                      dataIdxs={dataIdxs}
                      seriesIdx={seriesIdx}
                      mode={options.tooltip.mode}
                      sortOrder={options.tooltip.sort}
                      isPinned={isPinned}
                      maxHeight={options.tooltip.maxHeight}
                      replaceVariables={replaceVariables}
                    />
                  );
                }}
                maxWidth={options.tooltip.maxWidth}
              />
            )}
          </>
        );
      }}
    </TimeSeries>
  );
};
