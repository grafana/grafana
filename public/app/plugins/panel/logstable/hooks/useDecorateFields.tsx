import { useMemo } from 'react';

import { type DataFrame, type PanelData } from '@grafana/data';
import { type CustomCellRendererProps, TableCellDisplayMode } from '@grafana/ui';
import { type LogsFrame } from 'app/features/logs/logsFrame';

import { LogsTableCustomCellRenderer } from '../cells/LogsTableCustomCellRenderer';
import { getLogLevelColumnEnhancements } from '../fields/defaultLogLevelColumnConfig';
import { getTimeFieldWidth } from '../fields/getFieldWidth';
import { doesFieldSupportAdHocFiltering, doesFieldSupportInspector } from '../fields/supports';
import type { Options as LogsTableOptions } from '../panelcfg.gen';
import { type BuildLinkToLogLine } from '../types';

interface Props {
  data: PanelData;
  frameIndex: number;
  timeFieldName: string;
  levelFieldName: string;
  bodyFieldName: string;
  options: LogsTableOptions;
  logsFrame: LogsFrame | null;
  supportsPermalink: boolean;
  onPermalinkClick: BuildLinkToLogLine;
}

/**
 * The part of the panel's presentation that cannot be expressed as a transformation: log level
 * pills, the row-action column width, and the React cell renderer that draws the log line. These
 * are field config, not data, so they are applied after the pipeline and after field config rather
 * than inside a transformation — a transformation config has to be serialisable and a cell
 * renderer is a component.
 */
export function useDecorateFields({
  data,
  frameIndex,
  timeFieldName,
  levelFieldName,
  bodyFieldName,
  options,
  logsFrame,
  supportsPermalink,
  onPermalinkClick,
}: Props): PanelData {
  return useMemo(() => {
    const frame = data.series[frameIndex];

    if (!frame || !logsFrame) {
      return data;
    }

    const decorated = decorateFrame(
      frame,
      options,
      logsFrame,
      timeFieldName,
      levelFieldName,
      bodyFieldName,
      supportsPermalink,
      onPermalinkClick
    );

    const series = [...data.series];
    series.splice(frameIndex, 1, decorated);

    return { ...data, series };
  }, [
    data,
    frameIndex,
    logsFrame,
    options,
    timeFieldName,
    levelFieldName,
    bodyFieldName,
    supportsPermalink,
    onPermalinkClick,
  ]);
}

function decorateFrame(
  frame: DataFrame,
  options: LogsTableOptions,
  logsFrame: LogsFrame,
  timeFieldName: string,
  levelFieldName: string,
  bodyFieldName: string,
  supportsPermalink: boolean,
  onPermalinkClick: BuildLinkToLogLine
): DataFrame {
  const levelField = frame.fields.find((f) => f.name === levelFieldName);
  const isLevelFirstField = levelField ? frame.fields.indexOf(levelField) === 0 : false;

  const fields = frame.fields.map((field, fieldIndex) => {
    const isFirstField = (!isLevelFirstField && fieldIndex === 0) || (isLevelFirstField && fieldIndex === 1);
    // The pipeline runs before field config, so `field.config` here is already the fully resolved
    // config including panel defaults and per-field overrides. It only needs the additions below.
    const baseConfig = field.config;

    const levelEnhancements = getLogLevelColumnEnhancements(field, levelFieldName, baseConfig);

    const configAfterLevel = {
      ...baseConfig,
      ...(levelEnhancements?.mappings ? { mappings: levelEnhancements.mappings } : {}),
      custom: {
        ...baseConfig.custom,
        ...(levelEnhancements?.cellOptions ? { cellOptions: levelEnhancements.cellOptions } : {}),
        ...(levelEnhancements?.width !== undefined ? { width: levelEnhancements.width } : {}),
      },
    };

    // A cell renderer from a previous pass cannot be reused: it closes over the options and logs
    // frame it was built with.
    if (configAfterLevel.custom?.cellOptions?.cellComponent) {
      configAfterLevel.custom.cellOptions = undefined;
    }

    return {
      ...field,
      config: {
        ...configAfterLevel,
        filterable: baseConfig.filterable ?? doesFieldSupportAdHocFiltering(field, timeFieldName, bodyFieldName),
        custom: {
          ...configAfterLevel.custom,
          width:
            field.name === timeFieldName
              ? getTimeFieldWidth(configAfterLevel.custom?.width, fieldIndex, options)
              : configAfterLevel.custom?.width,
          inspect: configAfterLevel.custom?.inspect ?? doesFieldSupportInspector(field),
          cellOptions:
            isFirstField && bodyFieldName && (supportsPermalink || options.enableLogDetails)
              ? {
                  type: TableCellDisplayMode.Custom,
                  cellComponent: (cellProps: CustomCellRendererProps) => (
                    <LogsTableCustomCellRenderer
                      logsFrame={logsFrame}
                      supportsPermalink={supportsPermalink}
                      cellProps={cellProps}
                      options={options}
                      buildLinkToLog={onPermalinkClick}
                    />
                  ),
                }
              : configAfterLevel.custom?.cellOptions,
        },
      },
    };
  });

  return { ...frame, fields };
}
