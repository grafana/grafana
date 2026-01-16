import { css } from '@emotion/css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { lastValueFrom } from 'rxjs';

import {
  applyFieldOverrides,
  DataFrame,
  Field,
  FieldConfigSource,
  getFieldDisplayName,
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
import { TablePanel } from '../table/TablePanel';
import type { Options as TableOptions } from '../table/panelcfg.gen';

import { buildColumnsWithMeta } from './ColumnsWithMeta';
import { LogsTableCustomCellRenderer } from './CustomCellRenderer';
import type { Options as LogsTableOptions } from './panelcfg.gen';
import { isBuildLinkToLogLine, isOnLogsTableOptionsChange, OnLogsTableOptionsChange } from './types';

interface LogsTablePanelProps extends PanelProps<LogsTableOptions> {
  frameIndex?: number;
  showHeader?: boolean;
}

// Defaults
const DEFAULT_SIDEBAR_WIDTH = 200;
const DEFAULT_TIME_FIELD_WIDTH = 160;
export const ROW_ACTION_BUTTON_WIDTH = 80;

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
  // const [displayedFields, setDisplayedFields] = useState<string[]>(options.displayedFields ?? defaultDisplayedFields);
  const displayedFields = options.displayedFields ?? defaultDisplayedFields;
  const [columnsWithMeta, setColumnsWithMeta] = useState<FieldNameMetaStore | null>(null);
  const styles = useStyles2(getStyles, DEFAULT_SIDEBAR_WIDTH, height, width);
  const dataLinksContext = useDataLinksContext();
  const dataLinkPostProcessor = dataLinksContext.dataLinkPostProcessor;

  // Methods
  const onLogsTableOptionsChange: OnLogsTableOptionsChange | undefined = isOnLogsTableOptionsChange(onOptionsChange)
    ? onOptionsChange
    : undefined;

  const handleLogsTableOptionsChange = useCallback(
    (options: LogsTableOptions) => {
      onOptionsChange(options);
    },
    [onOptionsChange]
  );

  const handleSetDisplayedFields = useCallback(
    (displayedFields: string[]) => {
      handleLogsTableOptionsChange({ ...options, displayedFields: displayedFields });
    },
    [handleLogsTableOptionsChange, options]
  );

  // Callbacks
  const onTableOptionsChange = useCallback(
    (options: TableOptions) => {
      onLogsTableOptionsChange?.(options);
    },
    [onLogsTableOptionsChange]
  );

  const handleTableOnFieldConfigChange = useCallback(
    (fieldConfig: FieldConfigSource) => {
      onFieldConfigChange(fieldConfig);
    },
    [onFieldConfigChange]
  );

  const handleSetColumnsWithMeta = useCallback((columnsWithMeta: FieldNameMetaStore) => {
    setColumnsWithMeta(columnsWithMeta);
  }, []);

  /**
   * Extract fields transform
   */
  useEffect(() => {
    console.log('useEffect:: extract fields');
    // @todo move
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
    console.log('useEffect:: organize fields');
    // @todo move
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
              width: getFieldWidth(field.config.custom?.width, field, fieldIndex, logsFrame),
              inspect: field.config?.custom?.inspect ?? doesFieldSupportInspector(field, logsFrame),
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
                  : undefined,
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

  /**
   * Build columns meta
   */
  useEffect(() => {
    if (logsFrame === null) {
      return;
    }

    handleSetColumnsWithMeta(buildColumnsWithMeta(logsFrame, logsFrame?.timeField.values.length, displayedFields));
  }, [displayedFields, handleSetColumnsWithMeta, logsFrame]);

  if (extractedFrame === null || organizedFrame === null || logsFrame === null || columnsWithMeta === null) {
    return;
  }

  console.log('render::LogsTable', { extractedFrame, organizedFrame, columnsWithMeta });

  return (
    <div className={styles.wrapper}>
      <div className={styles.sidebarWrapper}>
        <LogsTableFieldSelector
          clear={() => {
            handleSetDisplayedFields(defaultDisplayedFields);
          }}
          columnsWithMeta={columnsWithMeta}
          dataFrames={extractedFrame}
          logs={[]}
          reorder={(columns: string[]) => {
            handleSetDisplayedFields(columns);
          }}
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

function getFieldWidth(width: number | undefined, field: Field, fieldIndex: number, logsFrame: LogsFrame) {
  if (width !== undefined) {
    if (fieldIndex === 0) {
      return width + ROW_ACTION_BUTTON_WIDTH;
    }
    return width;
  }

  return width ?? getDefaultFieldWidth(field, fieldIndex, logsFrame);
}

function getDefaultFieldWidth(field: Field, fieldIndex: number, logsFrame: LogsFrame): number | undefined {
  if (getFieldDisplayName(field) === logsFrame.timeField.name) {
    if (fieldIndex === 0) {
      return DEFAULT_TIME_FIELD_WIDTH + ROW_ACTION_BUTTON_WIDTH;
    }
    return DEFAULT_TIME_FIELD_WIDTH;
  }

  return undefined;
}

function doesFieldSupportInspector(field: Field, logsFrame: LogsFrame) {
  return false;
}

function doesFieldSupportAdHocFiltering(field: Field, logsFrame: LogsFrame): boolean {
  const unsupportedFields = [logsFrame.timeField.name, logsFrame.bodyField.name];
  return !unsupportedFields.includes(getFieldDisplayName(field));
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
