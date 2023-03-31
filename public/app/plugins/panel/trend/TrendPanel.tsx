import React, { useMemo } from 'react';

import { PanelProps } from '@grafana/data';
import { config, PanelDataErrorView } from '@grafana/runtime';
import {
  KeyboardPlugin,
  TimeSeries,
  TooltipDisplayMode,
  TooltipPlugin,
  usePanelContext,
  ZoomPlugin,
} from '@grafana/ui';
import { findField } from 'app/features/dimensions';

import { ContextMenuPlugin } from '../timeseries/plugins/ContextMenuPlugin';
import { prepareGraphableFields, regenerateLinksSupplier } from '../timeseries/utils';

import { PanelOptions } from './panelcfg.gen';

export const TrendPanel = ({
  data,
  timeRange,
  timeZone,
  width,
  height,
  options,
  fieldConfig,
  onChangeTimeRange,
  replaceVariables,
  id,
}: PanelProps<PanelOptions>) => {
  const { sync } = usePanelContext();

  const info = useMemo(() => {
    if (data.series.length > 1) {
      return {
        warning: 'Only one frame is supported, consider adding a join transformation',
        frames: data.series,
      };
    }

    const frames = prepareGraphableFields(data.series, config.theme2);
    if (frames && options.xField?.length) {
      const f = findField(frames[0], options.xField);
      if (!f) {
        return {
          warning: 'Unable to find field: ' + options.xField,
          frames,
        };
      }
      // TODO? do we need to make sure it is first?
    }
    return { frames };
  }, [data, options.xField]);

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
        if (
          alignedDataFrame.fields.filter((f) => f.config.links !== undefined && f.config.links.length > 0).length > 0
        ) {
          alignedDataFrame = regenerateLinksSupplier(alignedDataFrame, info.frames!, replaceVariables, timeZone);
        }

        return (
          <>
            <KeyboardPlugin config={config} />
            <ZoomPlugin config={config} onZoom={onChangeTimeRange} />
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
