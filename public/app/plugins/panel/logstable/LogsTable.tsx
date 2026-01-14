import { css } from '@emotion/css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { lastValueFrom } from 'rxjs';

import {
  applyFieldOverrides,
  DataFrame,
  Field,
  FieldConfigSource,
  GrafanaTheme2,
  PanelProps,
  transformDataFrame,
  useDataLinksContext,
} from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { CustomCellRendererProps, TableCellDisplayMode, useStyles2 } from '@grafana/ui';

import { config } from '../../../core/config';
import { getLogsExtractFields } from '../../../features/explore/Logs/LogsTable';
import { FieldNameMetaStore } from '../../../features/explore/Logs/LogsTableWrap';
import { LogsTableFieldSelector } from '../../../features/logs/components/fieldSelector/FieldSelector';
import {
  LOGS_DATAPLANE_BODY_NAME,
  LOGS_DATAPLANE_TIMESTAMP_NAME,
  LogsFrame,
  parseLogsFrame,
} from '../../../features/logs/logsFrame';
import { isSetDisplayedFields } from '../logs/types';
import { TablePanel } from '../table/TablePanel';
import type { Options as TableOptions } from '../table/panelcfg.gen';

import { LogsTableCustomCellRenderer } from './CustomCellRenderer';
import type { Options as LogsTableOptions } from './panelcfg.gen';
import { isBuildLinkToLogLine, isOnLogsTableOptionsChange, OnLogsTableOptionsChange } from './types';

interface LogsTablePanelProps extends PanelProps<LogsTableOptions> {
  frameIndex?: number;
  showHeader?: boolean;
}

// Defaults
const DEFAULT_SIDEBAR_WIDTH = 200;

export const LogsTable = ({
  data,
  width,
  height,
  timeRange,
  fieldConfig,
  options,
  eventBus,
  frameIndex = 0,
  showHeader = true, // @todo not pulling from panel settings
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
  // Variables
  const unTransformedDataFrame = data.series[frameIndex];

  // Hooks
  const logsFrame: LogsFrame | null = useMemo(() => parseLogsFrame(unTransformedDataFrame), [unTransformedDataFrame]);
  const defaultDisplayedFields = useMemo(
    () => [
      logsFrame?.timeField.name ?? LOGS_DATAPLANE_TIMESTAMP_NAME,
      logsFrame?.bodyField.name ?? LOGS_DATAPLANE_BODY_NAME,
    ],
    [logsFrame?.timeField.name, logsFrame?.bodyField.name]
  );

  // State
  const [extractedFrame, setExtractedFrame] = useState<DataFrame[] | null>(null);
  const [organizedFrame, setOrganizedFrame] = useState<DataFrame[] | null>(null);
  const [displayedFields, setDisplayedFields] = useState<string[]>(options.displayedFields ?? defaultDisplayedFields);
  const styles = useStyles2(getStyles, DEFAULT_SIDEBAR_WIDTH, height, width);
  const dataLinksContext = useDataLinksContext();
  const dataLinkPostProcessor = dataLinksContext.dataLinkPostProcessor;

  // Methods
  const onLogsTableOptionsChange: OnLogsTableOptionsChange | undefined = isOnLogsTableOptionsChange(onOptionsChange)
    ? onOptionsChange
    : undefined;

  const setDisplayedFieldsFn = isSetDisplayedFields(options.setDisplayedFields)
    ? options.setDisplayedFields
    : setDisplayedFields;

  // Callbacks
  const onTableOptionsChange = useCallback(
    (options: TableOptions) => {
      onLogsTableOptionsChange?.(options);
    },
    [onLogsTableOptionsChange]
  );

  const handleLogsTableOptionsChange = useCallback(
    (options: LogsTableOptions) => {
      onOptionsChange(options);
    },
    [onOptionsChange]
  );

  const handleSetDisplayedFields = useCallback(
    (displayedFields: string[]) => {
      setDisplayedFieldsFn(displayedFields);
      handleLogsTableOptionsChange({ ...options, displayedFields: displayedFields });
    },
    [handleLogsTableOptionsChange, options, setDisplayedFieldsFn]
  );

  const handleTableOnFieldConfigChange = useCallback(
    (fieldConfig: FieldConfigSource) => {
      onFieldConfigChange(fieldConfig);
    },
    [onFieldConfigChange]
  );

  /**
   * Extract fields transform
   */
  useEffect(() => {
    const extractFields = async () => {
      return await lastValueFrom(
        transformDataFrame(getLogsExtractFields(unTransformedDataFrame), [unTransformedDataFrame])
      );
    };

    extractFields().then((data) => {
      const extractedFrames = applyFieldOverrides({
        data,
        fieldConfig,
        replaceVariables: replaceVariables ?? getTemplateSrv().replace.bind(getTemplateSrv()),
        theme: config.theme2,
        timeZone: timeZone,
        dataLinkPostProcessor,
      });
      setExtractedFrame(extractedFrames);
    });
  }, [dataLinkPostProcessor, fieldConfig, replaceVariables, timeZone, unTransformedDataFrame]);

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

      const organizedFrame = await lastValueFrom(
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
          extractedFrame
        )
      );

      if (!logsFrame) {
        throw new Error('missing logsFrame');
      }

      for (let frameIndex = 0; frameIndex < organizedFrame.length; frameIndex++) {
        const frame = organizedFrame[frameIndex];
        for (const [fieldIndex, field] of frame.fields.entries()) {
          const isFirstField = fieldIndex === 0;

          field.config = {
            ...field.config,
            filterable: field.config?.filterable ?? doesFieldSupportAdHocFiltering(field, logsFrame),
            custom: {
              ...field.config.custom,
              inspect: field.config?.custom?.inspect ?? doesFieldSupportInspector(field, logsFrame),
              // @todo add row actions panel option
              cellOptions:
                isFirstField && logsFrame
                  ? {
                      type: TableCellDisplayMode.Custom,
                      cellComponent: (cellProps: CustomCellRendererProps) => (
                        <LogsTableCustomCellRenderer
                          cellProps={cellProps}
                          logsFrame={logsFrame}
                          buildLinkToLog={
                            isBuildLinkToLogLine(options.buildLinkToLogLine) ? options.buildLinkToLogLine : undefined
                          }
                        />
                      ),
                    }
                  : field.config.custom?.cellOptions,
            },
          };
        }
      }

      return organizedFrame;
    };

    organizeFields(displayedFields).then((frame) => {
      if (frame) {
        setOrganizedFrame(frame);
      }
    });
  }, [extractedFrame, displayedFields, logsFrame, options.buildLinkToLogLine]);

  if (extractedFrame === null || organizedFrame === null || logsFrame === null) {
    return;
  }

  console.log('render::LogsTable', { extractedFrame, organizedFrame });

  return (
    <div className={styles.wrapper}>
      <div className={styles.sidebarWrapper}>
        <LogsTableFieldSelector
          clear={() => {}}
          columnsWithMeta={displayedFieldsToColumns(displayedFields, logsFrame)}
          dataFrames={extractedFrame}
          logs={[]}
          reorder={(columns: string[]) => {}}
          setSidebarWidth={(width) => {}}
          sidebarWidth={DEFAULT_SIDEBAR_WIDTH}
          toggle={(key: string) => {
            if (displayedFields.includes(key)) {
              handleSetDisplayedFields(displayedFields.filter((f) => f !== key));
            } else {
              handleSetDisplayedFields([...displayedFields, key]);
            }
          }}
        />
      </div>
      <div className={styles.tableWrapper}>
        <TablePanel
          data={{ ...data, series: organizedFrame }}
          width={width - DEFAULT_SIDEBAR_WIDTH}
          height={height}
          id={id}
          timeRange={timeRange}
          timeZone={timeZone}
          options={{ ...options, frameIndex, showHeader }}
          transparent={transparent}
          fieldConfig={fieldConfig}
          renderCounter={renderCounter}
          title={title}
          eventBus={eventBus}
          onOptionsChange={onTableOptionsChange}
          onFieldConfigChange={handleTableOnFieldConfigChange}
          replaceVariables={replaceVariables}
          onChangeTimeRange={onChangeTimeRange}
        />
      </div>
    </div>
  );
};

function displayedFieldsToColumns(displayedFields: string[], logsFrame: LogsFrame): FieldNameMetaStore {
  const columns: FieldNameMetaStore = {};
  for (const [idx, field] of displayedFields.entries()) {
    columns[field] = {
      percentOfLinesWithLabel: 0,
      type:
        field === logsFrame.bodyField.name
          ? 'BODY_FIELD'
          : field === logsFrame.timeField.name
            ? 'TIME_FIELD'
            : undefined,
      active: true,
      index: idx,
    };
  }

  return columns;
}

function doesFieldSupportInspector(field: Field, logsFrame: LogsFrame) {
  // const unsupportedFields = [logsFrame.bodyField.name]
  // return !unsupportedFields.includes(field.name);
  return false;
}

function doesFieldSupportAdHocFiltering(field: Field, logsFrame: LogsFrame): boolean {
  const unsupportedFields = [logsFrame.timeField.name, logsFrame.bodyField.name];
  return !unsupportedFields.includes(field.name);
}

const getStyles = (theme: GrafanaTheme2, sidebarWidth: number, height: number, width: number) => {
  return {
    tableWrapper: css({
      paddingLeft: sidebarWidth,
      height,
      width,
    }),
    sidebarWrapper: css({
      position: 'absolute',
      height: height,
      width: sidebarWidth,
    }),
    wrapper: css({
      height,
      width,
    }),
  };
};
