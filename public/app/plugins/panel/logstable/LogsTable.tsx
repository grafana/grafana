import { css } from '@emotion/css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { lastValueFrom } from 'rxjs';

import {
  applyFieldOverrides,
  DataFrame,
  FieldConfigSource,
  GrafanaTheme2,
  PanelProps,
  transformDataFrame,
  useDataLinksContext,
} from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';
import { config } from 'app/core/config';
import { getLogsExtractFields } from 'app/features/explore/Logs/LogsTable';
import {
  LOGS_DATAPLANE_BODY_NAME,
  LOGS_DATAPLANE_TIMESTAMP_NAME,
  LogsFrame,
  parseLogsFrame,
} from 'app/features/logs/logsFrame';
import type { Options as TableOptions } from 'app/plugins/panel/table/panelcfg.gen';

import { LogsTableFields } from './LogsTableFields';
import { TableNGWrap } from './TableNGWrap';
import { DEFAULT_SIDEBAR_WIDTH } from './constants';
import { useOrganizeFields } from './hooks/useOrganizeFields';
import type { Options as LogsTableOptions } from './panelcfg.gen';
import { isOnLogsTableOptionsChange, OnLogsTableOptionsChange } from './types';

interface LogsTablePanelProps extends PanelProps<LogsTableOptions> {
  frameIndex?: number;
  showHeader?: boolean;
}

// Defaults
export const ROW_ACTION_BUTTON_WIDTH = 55;

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
  const timeFieldName = logsFrame?.timeField.name ?? LOGS_DATAPLANE_TIMESTAMP_NAME;
  const bodyFieldName = logsFrame?.bodyField.name ?? LOGS_DATAPLANE_BODY_NAME;

  // State
  const [extractedFrame, setExtractedFrame] = useState<DataFrame[] | null>(null);
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
      console.log('handleSetDisplayedFields', displayedFields);
      handleLogsTableOptionsChange({ ...options, displayedFields });
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

  const { organizedFrame } = useOrganizeFields({ extractedFrame, timeFieldName, bodyFieldName, options });

  const panelData = useMemo(() => {
    if (organizedFrame) {
      return { ...data, series: organizedFrame };
    }

    return null;
  }, [organizedFrame, data]);

  if (
    extractedFrame === null ||
    organizedFrame === null ||
    logsFrame === null ||
    !timeFieldName ||
    !bodyFieldName ||
    panelData === null
  ) {
    return;
  }

  console.log('render::LogsTable', { extractedFrame, organizedFrame });

  return (
    <div className={styles.wrapper}>
      <LogsTableFields
        displayedFields={options.displayedFields}
        height={height}
        logsFrame={logsFrame}
        timeFieldName={timeFieldName}
        bodyFieldName={bodyFieldName}
        dataFrames={extractedFrame}
        onDisplayedFieldsChange={handleSetDisplayedFields}
      />

      <TableNGWrap
        data={panelData}
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
  );
};

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
