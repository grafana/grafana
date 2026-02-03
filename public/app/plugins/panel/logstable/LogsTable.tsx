import { css } from '@emotion/css';
import { useCallback, useMemo } from 'react';

import {
  CoreApp,
  DataFrame,
  FieldConfigSource,
  GrafanaTheme2,
  LoadingState,
  PanelData,
  PanelProps,
} from '@grafana/data';
import type { Options as TableOptions } from '@grafana/schema/src/raw/composable/table/panelcfg/x/TablePanelCfg_types.gen';
import { useStyles2 } from '@grafana/ui';
import { FIELD_SELECTOR_DEFAULT_WIDTH } from 'app/features/logs/components/fieldSelector/FieldSelector';
import {
  LOGS_DATAPLANE_BODY_NAME,
  LOGS_DATAPLANE_TIMESTAMP_NAME,
  LogsFrame,
  parseLogsFrame,
} from 'app/features/logs/logsFrame';
import { PanelDataErrorView } from 'app/features/panel/components/PanelDataErrorView';

import { TableNGWrap } from './TableNGWrap';
import { LogsTableFields } from './fieldSelector/LogsTableFields';
import { useExtractFields } from './hooks/useExtractFields';
import { useOrganizeFields } from './hooks/useOrganizeFields';
import { copyLogsTableDashboardUrl } from './links/copyDashboardUrl';
import { getDisplayedFields } from './options/getDisplayedFields';
import { Options } from './options/types';
import { getLogsTablePanelState } from './panelState/getLogsTablePanelState';
import type { Options as LogsTableOptions } from './panelcfg.gen';
import { BuildLinkToLogLine, isOnLogsTableOptionsChange, OnLogsTableOptionsChange } from './types';

interface LogsTablePanelProps extends PanelProps<Options> {}

export const LogsTable = ({
  data,
  width,
  height,
  timeRange,
  fieldConfig,
  options,
  eventBus,
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
  const frameIndex = options.frameIndex <= data.series.length - 1 ? options.frameIndex : 0;
  const sidebarWidth = options.fieldSelectorWidth ?? FIELD_SELECTOR_DEFAULT_WIDTH;
  const styles = useStyles2(getStyles, sidebarWidth, height, width);

  const rawTableFrame: DataFrame | null = data.series[frameIndex] ? data.series[frameIndex] : null;
  const logsFrame: LogsFrame | null = useMemo(
    () => (rawTableFrame ? parseLogsFrame(rawTableFrame) : null),
    [rawTableFrame]
  );
  const timeFieldName = logsFrame?.timeField.name ?? LOGS_DATAPLANE_TIMESTAMP_NAME;
  // @todo otelLogsFormatting
  const bodyFieldName = logsFrame?.bodyField.name ?? LOGS_DATAPLANE_BODY_NAME;
  const permalinkedLogId = getLogsTablePanelState()?.logs?.id ?? undefined;
  const initialRowIndex = permalinkedLogId
    ? logsFrame?.idField?.values?.findIndex((id) => id === permalinkedLogId)
    : undefined;

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
    (options: Options) => {
      onOptionsChange(options);
    },
    [onOptionsChange]
  );

  const handleLogsTableOptionChange = useCallback(
    (prop: LogsTableOptions) => {
      handleLogsTableOptionsChange({ ...options, ...prop });
    },
    [handleLogsTableOptionsChange, options]
  );

  const handleTableOnFieldConfigChange = useCallback(
    (fieldConfig: FieldConfigSource) => {
      onFieldConfigChange(fieldConfig);
    },
    [onFieldConfigChange]
  );

  const supportsPermalink = useCallback(() => {
    return !(
      data?.request?.app !== CoreApp.Dashboard &&
      data?.request?.app !== CoreApp.PanelEditor &&
      data?.request?.app !== CoreApp.PanelViewer
    );
  }, [data?.request?.app]);

  const onPermalinkClick: BuildLinkToLogLine = useCallback(
    (logId: string) => {
      return copyLogsTableDashboardUrl(logId, data.timeRange);
    },
    [data.timeRange]
  );

  // Extract fields transform
  const { extractedFrame } = useExtractFields({ rawTableFrame, fieldConfig, timeZone });

  // Organize fields transform
  const { organizedFrame } = useOrganizeFields({
    extractedFrame,
    timeFieldName,
    bodyFieldName,
    options,
    logsFrame,
    supportsPermalink: supportsPermalink(),
    onPermalinkClick,
  });

  // Build panel data
  const panelData: PanelData | null = useMemo(() => {
    if (organizedFrame) {
      const series = [...data.series];
      series.splice(frameIndex, 1, organizedFrame);
      return { ...data, series, frameIndex };
    }

    return data;
  }, [organizedFrame, data, frameIndex]);

  // Show no data state if query returns nothing
  if (data.series.length === 0 && data.state === LoadingState.Done) {
    return <PanelDataErrorView fieldConfig={fieldConfig} panelId={id} data={data} needsStringField />;
  }

  // We're rendering before the hooks have transformed the required data, we return null to prevent the panel data error view from flashing
  if (!timeFieldName || !bodyFieldName || !logsFrame || !organizedFrame || !extractedFrame) {
    return null;
  }

  console.log('Render', {
    displayedFields: options.displayedFields,
    options,
    panelData,
  });

  return (
    <div className={styles.wrapper}>
      <LogsTableFields
        tableWidth={width}
        sidebarWidth={options.fieldSelectorWidth}
        displayedFields={getDisplayedFields(options, timeFieldName, bodyFieldName)}
        height={height}
        logsFrame={logsFrame}
        timeFieldName={timeFieldName}
        bodyFieldName={bodyFieldName}
        dataFrame={extractedFrame}
        onDisplayedFieldsChange={(displayedFields: string[]) => handleLogsTableOptionChange({ displayedFields })}
        onSidebarWidthChange={(width: number) => handleLogsTableOptionChange({ fieldSelectorWidth: width })}
      />

      <TableNGWrap
        initialRowIndex={initialRowIndex}
        data={panelData}
        width={width}
        height={height}
        id={id}
        timeRange={timeRange}
        timeZone={timeZone}
        options={options}
        transparent={transparent}
        fieldConfig={fieldConfig}
        renderCounter={renderCounter}
        title={title}
        eventBus={eventBus}
        onOptionsChange={handleTableOptionsChange}
        onFieldConfigChange={handleTableOnFieldConfigChange}
        replaceVariables={replaceVariables}
        onChangeTimeRange={onChangeTimeRange}
        fieldSelectorWidth={options.fieldSelectorWidth}
      />
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2, sidebarWidth: number, height: number, width: number) => {
  return {
    wrapper: css({
      height,
      width,
    }),
  };
};
