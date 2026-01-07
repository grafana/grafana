import { useEffect, useState } from 'react';
import { lastValueFrom } from 'rxjs';

import { DataFrame, PanelProps, transformDataFrame } from '@grafana/data';

import { getLogsExtractFields } from '../../../features/explore/Logs/LogsTable';
import { LogsFrame, parseLogsFrame } from '../../../features/logs/logsFrame';
import { TablePanel } from '../table/TablePanel';
import type { Options as TableOptions } from '../table/panelcfg.gen';

import type { Options } from './panelcfg.gen';

interface LogsTablePanelProps extends PanelProps<Options> {
  frameIndex?: number;
  showHeader?: boolean;
}

export const LogsTable = ({
  data,
  width,
  height,
  timeRange,
  fieldConfig,
  options,
  eventBus,
  frameIndex = 0,
  showHeader = true,
  onOptionsChange,
  onFieldConfigChange,
  replaceVariables,
  onChangeTimeRange,
  title,
  transparent,
  timeZone,
  id,
  renderCounter,
}: LogsTablePanelProps) => {
  const logsFrame: LogsFrame | null = parseLogsFrame(data.series[frameIndex]);
  if (!logsFrame?.timeField.name || !logsFrame?.bodyField.name) {
    throw new Error(`Invalid logsFrame frame name: ${frameIndex}`);
  }

  const [extractedFrame, setExtractedFrame] = useState<DataFrame | null>(null);
  const [organizedFrame, setOrganizedFrame] = useState<DataFrame | null>(null);

  const onTableOptionsChange = (options: TableOptions) => {
    onOptionsChange({});
  };

  const unTransformedDataFrame = data.series[frameIndex];

  /**
   * Extract fields transform
   */
  useEffect(() => {
    const extractFields = async () => {
      return await lastValueFrom(
        transformDataFrame(getLogsExtractFields(unTransformedDataFrame), [unTransformedDataFrame])
      );
    };

    extractFields().then((frame) => {
      setExtractedFrame(frame[0]);
    });
  }, [unTransformedDataFrame]);

  /**
   * Organize fields transform
   */
  useEffect(() => {
    const organizeFields = async (displayedFields: string[]) => {
      if (!extractedFrame) {
        return Promise.resolve(null);
      }

      let indexByName: Record<string, number> = {};
      let includeByName: Record<string, boolean> = {};
      if (displayedFields) {
        for (const [idx, field] of displayedFields.entries()) {
          indexByName[field] = idx;
          includeByName[field] = true;
        }
      }

      return await lastValueFrom(
        transformDataFrame(
          [
            {
              id: 'organize',
              options: {
                indexByName,
                includeByName,
              },
            },
          ],
          [extractedFrame]
        )
      );
    };

    organizeFields(options.displayedFields ?? [logsFrame.timeField.name, logsFrame.bodyField.name]).then((frame) => {
      if (frame) {
        setOrganizedFrame(frame[0]);
      }
    });
  }, [extractedFrame, options.displayedFields, logsFrame.timeField.name, logsFrame.bodyField.name]);

  if (extractedFrame === null || organizedFrame === null) {
    return;
  }

  console.log('render::LogsTable', { extractedFrame });

  return (
    <TablePanel
      data={{ ...data, series: [organizedFrame] }}
      width={width}
      height={height}
      id={id}
      timeRange={timeRange}
      timeZone={timeZone}
      options={{ ...options, frameIndex: 0, showHeader }}
      transparent={transparent}
      fieldConfig={fieldConfig}
      renderCounter={renderCounter}
      title={title}
      eventBus={eventBus}
      onOptionsChange={onTableOptionsChange}
      onFieldConfigChange={onFieldConfigChange}
      replaceVariables={replaceVariables}
      onChangeTimeRange={onChangeTimeRange}
    />
  );
};
