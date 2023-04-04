import React, { useMemo } from 'react';

import { FieldType, PanelProps } from '@grafana/data';
import { config, PanelDataErrorView } from '@grafana/runtime';
import { KeyboardPlugin, TimeSeries, TooltipDisplayMode, TooltipPlugin, usePanelContext } from '@grafana/ui';
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

    let xFieldName = options.xField;

    if (xFieldName) {
      const f = findField(data.series[0], xFieldName);

      if (!f) {
        return {
          warning: 'Unable to find field: ' + xFieldName,
          frames: data.series,
        };
      }
    } else {
      // first number field
      const f = data.series[0].fields.find((f) => f.type === FieldType.number);

      if (!f) {
        return {
          warning: 'No numeric fields found for X axis',
          frames: data.series,
        };
      }

      xFieldName = f.name;
    }

    const frames = prepareGraphableFields(data.series, xFieldName, config.theme2);

    return { frames, xFieldName };
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
      xField={info.xFieldName}
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
