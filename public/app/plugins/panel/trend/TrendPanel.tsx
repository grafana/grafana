import React, { useMemo } from 'react';

import { FieldType, PanelProps } from '@grafana/data';
import { isLikelyAscendingVector } from '@grafana/data/src/transformations/transformers/joinDataFrames';
import { config, PanelDataErrorView } from '@grafana/runtime';
import { KeyboardPlugin, TimeSeries, TooltipDisplayMode, TooltipPlugin, usePanelContext } from '@grafana/ui';
import { findFieldIndex } from 'app/features/dimensions';

import { ContextMenuPlugin } from '../timeseries/plugins/ContextMenuPlugin';
import { prepareGraphableFields, regenerateLinksSupplier } from '../timeseries/utils';

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
  const { sync } = usePanelContext();

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
      xFieldIdx = findFieldIndex(frames[0], options.xField);
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
    >
      {(config, alignedDataFrame) => {
        if (alignedDataFrame.fields.some((f) => Boolean(f.config.links?.length))) {
          alignedDataFrame = regenerateLinksSupplier(alignedDataFrame, info.frames!, replaceVariables, timeZone);
        }

        return (
          <>
            <KeyboardPlugin config={config} />
            {options.tooltip.mode === TooltipDisplayMode.None || (
              <TooltipPlugin
                frames={info.frames!}
                data={alignedDataFrame}
                config={config}
                mode={options.tooltip.mode}
                sortOrder={options.tooltip.sort}
                sync={sync}
                timeZone={timeZone}
              />
            )}

            <ContextMenuPlugin
              data={alignedDataFrame}
              frames={info.frames!}
              config={config}
              timeZone={timeZone}
              replaceVariables={replaceVariables}
              defaultItems={[]}
            />
          </>
        );
      }}
    </TimeSeries>
  );
};
