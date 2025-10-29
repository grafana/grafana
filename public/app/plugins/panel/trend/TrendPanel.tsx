import { useMemo } from 'react';

import {
  DataFrame,
  FieldMatcherID,
  fieldMatchers,
  FieldType,
  PanelProps,
  TimeRange,
  useDataLinksContext,
} from '@grafana/data';
import { PanelDataErrorView } from '@grafana/runtime';
import { KeyboardPlugin, TooltipDisplayMode, TooltipPlugin2, usePanelContext, useTheme2 } from '@grafana/ui';
import { TooltipHoverMode } from '@grafana/ui/internal';
import { XYFieldMatchers } from 'app/core/components/GraphNG/types';
import { preparePlotFrame } from 'app/core/components/GraphNG/utils';
import { TimeSeries } from 'app/core/components/TimeSeries/TimeSeries';

import { TimeSeriesTooltip } from '../timeseries/TimeSeriesTooltip';
import { prepareGraphableFields } from '../timeseries/utils';

import { Options } from './panelcfg.gen';
import { validateSeries } from './utils';

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
  const theme = useTheme2();
  const { dataLinkPostProcessor } = useDataLinksContext();
  const { canExecuteActions } = usePanelContext();

  const userCanExecuteActions = useMemo(() => canExecuteActions?.() ?? false, [canExecuteActions]);

  // Need to fallback to first number field if no xField is set in options otherwise panel crashes 😬
  const trendXFieldName =
    options.xField ?? data.series[0]?.fields.find((field) => field.type === FieldType.number)?.name;
  const preparePlotFrameTimeless = (frames: DataFrame[], dimFields: XYFieldMatchers, timeRange?: TimeRange | null) => {
    dimFields = {
      ...dimFields,
      x: fieldMatchers.get(FieldMatcherID.byName).get(trendXFieldName),
    };

    return preparePlotFrame(frames, dimFields);
  };

  const info = useMemo(() => {
    const frames = data.series;
    const { warning, xFieldIdx } = validateSeries(frames, options.xField);

    if (warning) {
      return { warning, frames };
    }

    return { frames: prepareGraphableFields(frames, theme, undefined, xFieldIdx) };
  }, [data.series, options.xField, theme]);

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
                getDataLinks={(seriesIdx, dataIdx) =>
                  alignedDataFrame.fields[seriesIdx].getLinks?.({ valueRowIndex: dataIdx }) ?? []
                }
                render={(u, dataIdxs, seriesIdx, isPinned = false, dismiss, timeRange, viaSync, dataLinks) => {
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
                      dataLinks={dataLinks}
                      hideZeros={options.tooltip.hideZeros}
                      canExecuteActions={userCanExecuteActions}
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
