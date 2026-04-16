import { css } from '@emotion/css';
import { useCallback, useMemo, useState } from 'react';

import {
  CoreApp,
  type DataFrame,
  type FieldConfigSource,
  type GrafanaTheme2,
  LoadingState,
  LogsSortOrder,
  type PanelData,
  type PanelProps,
} from '@grafana/data';
import { usePanelContext, useStyles2 } from '@grafana/ui';
import { SETTING_KEY_ROOT } from 'app/features/explore/Logs/utils/logs';
import { getDefaultFieldSelectorWidth } from 'app/features/logs/components/fieldSelector/FieldSelector';
import { LOG_LINE_BODY_FIELD_NAME } from 'app/features/logs/components/fieldSelector/logFields';
import { getLogsPanelState } from 'app/features/logs/components/panel/panelState/getLogsPanelState';
import { LogListModel } from 'app/features/logs/components/panel/processing';
import {
  DATAPLANE_SEVERITY_NAME,
  LOGS_DATAPLANE_BODY_NAME,
  LOGS_DATAPLANE_TIMESTAMP_NAME,
  type LogsFrame,
  parseLogsFrame,
} from 'app/features/logs/logsFrame';
import { dataFrameToLogsModel } from 'app/features/logs/logsModel';
import { PanelDataErrorView } from 'app/features/panel/components/PanelDataErrorView';

import { LogDetailsContextProvider } from './LogDetailsContext';
import { LogsTableDetails } from './LogsTableDetails';
import { TableNGWrap } from './TableNGWrap';
import { LogsTableFields } from './fieldSelector/LogsTableFields';
import { detectLevelField } from './fields/logs';
import { useExtractFields } from './hooks/useExtractFields';
import { useOrganizeFields } from './hooks/useOrganizeFields';
import { copyLogsTableDashboardUrl } from './links/copyDashboardUrl';
import { getDisplayedFields } from './options/getDisplayedFields';
import { onSortOrderChange } from './options/onSortOrderChange';
import { type Options } from './options/types';
import { type Options as LogsTableOptions } from './panelcfg.gen';
import { getInitialRowIndex } from './props/getInitialRowIndex';
import {
  type BuildLinkToLogLine,
  isBuildLinkToLogLine,
  isOnLogsTableOptionsChange,
  type OnLogsTableOptionsChange,
} from './types';

interface LogsTablePanelProps extends Omit<PanelProps<Options>, 'timeRange'> {}

export const LogsTable = ({
  data,
  width,
  height,
  fieldConfig: fieldConfigProp,
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
  const styles = useStyles2(getStyles, height, width);
  const { app } = usePanelContext();

  const rawTableFrame: DataFrame | null = data.series[frameIndex] ? data.series[frameIndex] : null;
  const logsFrame: LogsFrame | null = useMemo(
    () => (rawTableFrame ? parseLogsFrame(rawTableFrame) : null),
    [rawTableFrame]
  );
  const timeFieldName = logsFrame?.timeField.name ?? LOGS_DATAPLANE_TIMESTAMP_NAME;
  const levelFieldName = logsFrame?.severityField?.name ?? detectLevelField(logsFrame) ?? DATAPLANE_SEVERITY_NAME;
  const bodyFieldName = logsFrame?.bodyField.name ?? LOGS_DATAPLANE_BODY_NAME;
  const permalinkedLogId = options.permalinkedLogId ?? getLogsPanelState()?.logs?.id ?? undefined;
  const initialRowIndex = getInitialRowIndex(permalinkedLogId, logsFrame);

  const onLogsTableOptionsChange: OnLogsTableOptionsChange | undefined = isOnLogsTableOptionsChange(onOptionsChange)
    ? onOptionsChange
    : undefined;

  const [containerElement, setContainerElement] = useState<HTMLDivElement | null>(null);
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    setContainerElement(node);
  }, []);

  // Callbacks
  const handleTableOptionsChange = useCallback(
    (newOptions: Options) => {
      const pendingOptions = onSortOrderChange(newOptions, options.sortOrder, timeFieldName);
      onLogsTableOptionsChange?.(pendingOptions);
    },
    [onLogsTableOptionsChange, options.sortOrder, timeFieldName]
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

  const transformDisplayedFields = useCallback(
    (displayedFields: string[]) => {
      return displayedFields.map((displayedField) => {
        if (displayedField === bodyFieldName) {
          return LOG_LINE_BODY_FIELD_NAME;
        }

        return displayedField;
      });
    },
    [bodyFieldName]
  );

  const untransformDisplayedFields = useCallback(
    (displayedFields: string[]) => {
      return displayedFields.map((displayedField) => {
        if (displayedField === LOG_LINE_BODY_FIELD_NAME) {
          return bodyFieldName;
        }

        return displayedField;
      });
    },
    [bodyFieldName]
  );

  const handleTableOnFieldConfigChange = useCallback(
    (fieldConfig: FieldConfigSource) => {
      onFieldConfigChange(fieldConfig);
    },
    [onFieldConfigChange]
  );

  const supportsPermalink = useCallback(() => {
    return (
      !!options.buildLinkToLogLine ||
      !(
        data?.request?.app !== CoreApp.Dashboard &&
        data?.request?.app !== CoreApp.PanelEditor &&
        data?.request?.app !== CoreApp.PanelViewer
      )
    );
  }, [data?.request?.app, options.buildLinkToLogLine]);

  const onPermalinkClick: BuildLinkToLogLine = useCallback(
    (logId: string) => {
      return copyLogsTableDashboardUrl(logId, data.timeRange);
    },
    [data.timeRange]
  );

  const wrapText = useMemo(
    () => fieldConfigProp.defaults.custom?.wrapText ?? options.wrapText ?? false,
    [fieldConfigProp.defaults.custom?.wrapText, options.wrapText]
  );

  const handleWrapTextClick = useCallback(() => {
    const nextWrapText = !wrapText;
    if (app === CoreApp.Dashboard || app === CoreApp.PanelEditor || app === CoreApp.PanelViewer) {
      const nextFieldConfig: FieldConfigSource = {
        ...fieldConfigProp,
        defaults: {
          ...fieldConfigProp.defaults,
          custom: {
            ...fieldConfigProp.defaults.custom,
            wrapText: nextWrapText,
          },
        },
      };
      onFieldConfigChange(nextFieldConfig);
    } else {
      onOptionsChange({
        ...options,
        wrapText: nextWrapText,
      });
    }
  }, [app, fieldConfigProp, onFieldConfigChange, onOptionsChange, options, wrapText]);

  const fieldConfig = useMemo(
    () => ({
      ...fieldConfigProp,
      defaults: {
        ...fieldConfigProp.defaults,
        custom: {
          ...fieldConfigProp.defaults?.custom,
          filterable: true,
          wrapText,
        },
      },
    }),
    [fieldConfigProp, wrapText]
  );

  // Extract fields transform
  const { extractedFrame } = useExtractFields({ rawTableFrame, fieldConfig, timeZone });

  // Organize fields transform
  const { organizedFrame } = useOrganizeFields({
    extractedFrame,
    timeFieldName,
    levelFieldName,
    bodyFieldName,
    logsFrame,
    supportsPermalink: supportsPermalink(),
    onPermalinkClick: isBuildLinkToLogLine(options.buildLinkToLogLine) ? options.buildLinkToLogLine : onPermalinkClick,
    options,
    fieldConfig,
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

  const tableOptions = useMemo(
    () => ({
      sortOrder: LogsSortOrder.Descending,
      sortBy: [{ displayName: timeFieldName, desc: true }],
      fieldSelectorWidth: options.fieldSelectorWidth ?? getDefaultFieldSelectorWidth(),
      ...options,
      wrapText,
    }),
    [options, timeFieldName, wrapText]
  );

  const logRows = useMemo(() => {
    const logs = rawTableFrame
      ? dataFrameToLogsModel(
          [rawTableFrame],
          panelData.request?.intervalMs,
          undefined,
          panelData.request?.targets,
          false
        ).rows.map(
          (logRow) =>
            new LogListModel(logRow, {
              escape: false,
              timeZone,
              wrapLogMessage: true,
            })
        )
      : null;
    return logs ?? [];
  }, [panelData.request?.intervalMs, panelData.request?.targets, rawTableFrame, timeZone]);

  const noSeries = data.series.length === 0;
  const noValues = data.series[frameIndex]?.fields?.[0]?.values?.length === 0;

  // Logs frame be null for non logs frames
  const noLogsFrame = !logsFrame;

  // Show no data state if query returns nothing
  if ((noSeries || noValues || noLogsFrame) && data.state === LoadingState.Done) {
    return <PanelDataErrorView fieldConfig={fieldConfig} panelId={id} data={data} needsStringField />;
  }

  // Don't render the table if we don't have the required data to show the visualization
  const renderTable = timeFieldName && bodyFieldName && logsFrame && organizedFrame && extractedFrame;

  return (
    <div className={styles.wrapper} ref={containerRef}>
      {renderTable && containerElement && (
        <LogDetailsContextProvider enableLogDetails logs={logRows}>
          <LogsTableFields
            tableWidth={width}
            fieldSelectorWidth={options.fieldSelectorWidth}
            displayedFields={untransformDisplayedFields(getDisplayedFields(options, timeFieldName, levelFieldName))}
            height={height}
            logsFrame={logsFrame}
            timeFieldName={timeFieldName}
            levelFieldName={levelFieldName}
            bodyFieldName={bodyFieldName}
            dataFrame={extractedFrame}
            onDisplayedFieldsChange={(displayedFields: string[]) =>
              handleLogsTableOptionChange({ displayedFields: transformDisplayedFields(displayedFields) })
            }
            onFieldSelectorWidthChange={(width: number) => handleLogsTableOptionChange({ fieldSelectorWidth: width })}
          />

          <TableNGWrap
            containerElement={containerElement}
            initialRowIndex={initialRowIndex}
            data={panelData}
            width={width}
            height={height}
            id={id}
            timeZone={timeZone}
            options={tableOptions}
            transparent={transparent}
            fieldConfig={fieldConfig}
            renderCounter={renderCounter}
            title={title}
            eventBus={eventBus}
            onOptionsChange={handleTableOptionsChange}
            onFieldConfigChange={handleTableOnFieldConfigChange}
            replaceVariables={replaceVariables}
            onChangeTimeRange={onChangeTimeRange}
            onWrapTextClick={handleWrapTextClick}
            logOptionsStorageKey={SETTING_KEY_ROOT}
          />

          <LogsTableDetails timeRange={data.timeRange} timeZone={timeZone} />
        </LogDetailsContextProvider>
      )}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2, height: number, width: number) => {
  return {
    wrapper: css({
      // prevent overflow in the tiny suggestions preview
      overflow: 'hidden',
      height,
      width,
    }),
  };
};
