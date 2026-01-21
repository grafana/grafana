import { css } from '@emotion/css';
import { useCallback, useMemo } from 'react';

import { FieldConfigSource, GrafanaTheme2, PanelData, PanelProps } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import {
  LOGS_DATAPLANE_BODY_NAME,
  LOGS_DATAPLANE_TIMESTAMP_NAME,
  LogsFrame,
  parseLogsFrame,
} from 'app/features/logs/logsFrame';
import type { Options as TableOptions } from 'app/plugins/panel/table/panelcfg.gen';

import { TableNGWrap } from './TableNGWrap';
import { DEFAULT_SIDEBAR_WIDTH } from './constants';
import { LogsTableFields } from './fieldSelector/LogsTableFields';
import { useExtractFields } from './hooks/useExtractFields';
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
  const sidebarWidth = options.fieldSelectorWidth ?? DEFAULT_SIDEBAR_WIDTH;
  const styles = useStyles2(getStyles, sidebarWidth, height, width);

  const rawTableFrame = data.series[frameIndex];
  const logsFrame: LogsFrame | null = useMemo(() => parseLogsFrame(rawTableFrame), [rawTableFrame]);
  const timeFieldName = logsFrame?.timeField.name ?? LOGS_DATAPLANE_TIMESTAMP_NAME;
  const bodyFieldName = logsFrame?.bodyField.name ?? LOGS_DATAPLANE_BODY_NAME;

  const onLogsTableOptionsChange: OnLogsTableOptionsChange | undefined = isOnLogsTableOptionsChange(onOptionsChange)
    ? onOptionsChange
    : undefined;

  // Callbacks
  const handleTableOptionsChange = useCallback(
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

  // @todo create generic options setter
  const handleSetDisplayedFields = useCallback(
    (displayedFields: string[]) => {
      handleLogsTableOptionsChange({ ...options, displayedFields });
    },
    [handleLogsTableOptionsChange, options]
  );

  // @todo create generic options setter
  const handleSetFieldSelectorWidth = useCallback(
    (fieldSelectorWidth: number) => {
      handleLogsTableOptionsChange({ ...options, fieldSelectorWidth });
    },
    [handleLogsTableOptionsChange, options]
  );

  const handleTableOnFieldConfigChange = useCallback(
    (fieldConfig: FieldConfigSource) => {
      onFieldConfigChange(fieldConfig);
    },
    [onFieldConfigChange]
  );

  // Extract fields transform
  const { extractedFrame } = useExtractFields({ rawTableFrame, fieldConfig, timeZone });

  // Organize fields transform
  const { organizedFrame } = useOrganizeFields({ extractedFrame, timeFieldName, bodyFieldName, options });

  // Build panel data
  const panelData: PanelData | null = useMemo(() => {
    if (organizedFrame) {
      return { ...data, series: [organizedFrame] };
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

  // @todo seeing 4 renders on time range change
  console.log('render::LogsTable', { extractedFrame, organizedFrame });

  return (
    <div className={styles.wrapper}>
      <LogsTableFields
        width={options.fieldSelectorWidth}
        displayedFields={options.displayedFields}
        height={height}
        logsFrame={logsFrame}
        timeFieldName={timeFieldName}
        bodyFieldName={bodyFieldName}
        dataFrame={extractedFrame}
        onDisplayedFieldsChange={handleSetDisplayedFields}
        onWidthChange={handleSetFieldSelectorWidth}
      />

      <TableNGWrap
        data={panelData}
        width={width}
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
        onOptionsChange={handleTableOptionsChange}
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
