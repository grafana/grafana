import { css } from '@emotion/css';
import { groupBy } from 'lodash';
import { memo, useEffect, useMemo, useState } from 'react';

import {
  DataFrameType,
  type DataSourceApi,
  type GrafanaTheme2,
  hasLogsLabelTypesSupport,
  type TimeRange,
} from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { getDataSourceInstance } from '@grafana/runtime';
import { useFlagGrafanaOtelLogDetails } from '@grafana/runtime/internal';
import { Box, InlineField, InlineSwitch, useStyles2 } from '@grafana/ui';

import { getLabelTypeFromRow } from '../../utils';
import { createLogLineLinks } from '../logParser';
import { useAttributesExtensionLinks } from '../useAttributesExtensionLinks';

import { LogLineDetailsCollapsible } from './LogLineDetailsCollapsible';
import { LogLineDetailsError } from './LogLineDetailsError';
import { type LabelWithLinks, LogLineDetailsFields, LogLineDetailsLabelFields } from './LogLineDetailsFields';
import { LogLineDetailsLog } from './LogLineDetailsLog';
import { LogLineDetailsSummary } from './LogLineDetailsSummary';
import { LogLineDetailsTrace } from './LogLineDetailsTrace';
import { LogLineDetailsOTelComponent } from './LogLineOTelDetailsComponent';
import { useLogListContext } from './LogListContext';
import { reportInteractionOnce } from './analytics';
import { getTempoTraceFromLinks } from './links';
import { type LogListModel } from './processing';

interface LogLineDetailsComponentProps {
  log: LogListModel;
  logs: LogListModel[];
  prettifyDetailsJSON: boolean;
  search?: string;
  setPrettifyDetailsJSON: (prettifyDetailsJSON: boolean) => void;
  timeRange: TimeRange;
  timeZone: string;
}

export const LogLineDetailsComponent = ({
  log,
  logs,
  prettifyDetailsJSON,
  search = '',
  setPrettifyDetailsJSON,
  timeRange,
  timeZone,
}: LogLineDetailsComponentProps) => {
  const otelLogDetailsEnabled = useFlagGrafanaOtelLogDetails();

  return log.otelLanguage && otelLogDetailsEnabled ? (
    <LogLineDetailsOTelComponent
      log={log}
      logs={logs}
      prettifyDetailsJSON={prettifyDetailsJSON}
      search={search}
      setPrettifyDetailsJSON={setPrettifyDetailsJSON}
      timeRange={timeRange}
      timeZone={timeZone}
    />
  ) : (
    <LogLineDetailsLegacyComponent
      log={log}
      logs={logs}
      prettifyDetailsJSON={prettifyDetailsJSON}
      search={search}
      setPrettifyDetailsJSON={setPrettifyDetailsJSON}
      timeRange={timeRange}
      timeZone={timeZone}
    />
  );
};

const LogLineDetailsLegacyComponent = memo(
  ({
    log,
    logs,
    prettifyDetailsJSON,
    search = '',
    setPrettifyDetailsJSON,
    timeRange,
    timeZone,
  }: LogLineDetailsComponentProps) => {
    const { noInteractions, syntaxHighlighting, syntaxHighlightingUnavailable } = useLogListContext();

    const [ds, setDs] = useState<DataSourceApi | null | undefined>(undefined);
    const styles = useStyles2(getStyles);

    const extensionLinks = useAttributesExtensionLinks(log, timeRange);

    const fieldsWithLinks = useMemo(() => {
      const fieldsWithLinks = log.fields.filter((f) => f.links?.length);
      const displayedFieldsWithLinks = fieldsWithLinks.filter((f) => f.fieldIndex !== log.entryFieldIndex);
      const hiddenFieldsWithLinks = fieldsWithLinks.filter((f) => f.fieldIndex === log.entryFieldIndex);
      const fieldsWithLinksFromVariableMap = createLogLineLinks(hiddenFieldsWithLinks);
      return {
        links: displayedFieldsWithLinks,
        linksFromVariableMap: fieldsWithLinksFromVariableMap,
      };
    }, [log.entryFieldIndex, log.fields]);

    const fieldsWithoutLinks = useMemo(
      () =>
        log.dataFrame.meta?.type === DataFrameType.LogLines
          ? // for LogLines frames (dataplane) we don't want to show any additional fields besides already extracted labels and links
            []
          : // for other frames, do not show the log message unless there is a link attached
            log.fields.filter((f) => f.links?.length === 0 && f.fieldIndex !== log.entryFieldIndex).sort(),
      [log.dataFrame.meta?.type, log.entryFieldIndex, log.fields]
    );

    const labelsWithLinks: LabelWithLinks[] = useMemo(
      () =>
        Object.keys(log.labels)
          .sort()
          .map((label) => ({
            key: label,
            value: log.labels[label],
            links: extensionLinks?.[label],
          })),
      [extensionLinks, log.labels]
    );

    const trace = useMemo(() => getTempoTraceFromLinks(fieldsWithLinks.links), [fieldsWithLinks.links]);

    const groupedLabels = useMemo(() => {
      if (!ds) {
        return labelsWithLinks.length > 0
          ? {
              '': labelsWithLinks,
            }
          : {};
      }
      return groupBy(labelsWithLinks, (label) => {
        if (hasLogsLabelTypesSupport(ds)) {
          return ds.getLabelDisplayTypeFromFrame(label.key, log.dataFrame, log.rowIndex) ?? '';
        }
        return getLabelTypeFromRow(label.key, log, true) ?? '';
      });
    }, [ds, labelsWithLinks, log]);

    const labelGroups = useMemo(() => Object.keys(groupedLabels), [groupedLabels]);

    useEffect(() => {
      // Disable prettify by default when highlighting has been disabled because of heavy logs
      if (syntaxHighlightingUnavailable) {
        setPrettifyDetailsJSON(false);
      }
    }, [setPrettifyDetailsJSON, syntaxHighlightingUnavailable]);

    const noDetails =
      !fieldsWithLinks.links.length &&
      !fieldsWithLinks.linksFromVariableMap.length &&
      !labelGroups.length &&
      !fieldsWithoutLinks.length;

    useEffect(() => {
      if (noInteractions) {
        return;
      }
      reportInteractionOnce('logs_log_line_details_fields_displayed', {
        trace: trace !== undefined,
        fields: fieldsWithoutLinks.length,
        labels: labelsWithLinks.length,
        labelGroups: labelGroups.join(', '),
      });
      // Once
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
      getDataSourceInstance(log.datasourceUid)
        .then(setDs)
        .catch(() => setDs(null));
    }, [log.datasourceUid]);

    // Wait for ds to be resolved to DataSourceApi or null on error
    if (ds === undefined) {
      return null;
    }

    return (
      <div className={styles.componentWrapper}>
        <LogLineDetailsSummary log={log} />
        <div className={styles.details}>
          <LogLineDetailsCollapsible
            actions={
              log.body && log.isJSON ? (
                <InlineField label={t('logs.log-line-details.prettify', 'Prettify')}>
                  <InlineSwitch
                    value={prettifyDetailsJSON}
                    onChange={(event) => setPrettifyDetailsJSON(event.currentTarget.checked)}
                  />
                </InlineField>
              ) : undefined
            }
            defaultExpanded={false}
            id="log-line"
            label={t('logs.log-line-details.log-line-section', 'Log line')}
          >
            <LogLineDetailsLog
              log={log}
              prettifyJSON={prettifyDetailsJSON}
              syntaxHighlighting={syntaxHighlighting ?? true}
            />
          </LogLineDetailsCollapsible>

          <LogLineDetailsError className={styles.errorContainer} fields={fieldsWithoutLinks} labels={labelsWithLinks} />

          {trace && (
            <LogLineDetailsCollapsible
              defaultExpanded={false}
              id="trace"
              label={t('logs.log-line-details.trace-section', 'Trace')}
            >
              <LogLineDetailsTrace timeRange={timeRange} timeZone={timeZone} traceRef={trace} />
            </LogLineDetailsCollapsible>
          )}
          {labelGroups.map((group) =>
            group === '' ? (
              <LogLineDetailsCollapsible
                id="fields"
                key="fields"
                label={t('logs.log-line-details.fields-section', 'Fields')}
              >
                <LogLineDetailsLabelFields log={log} logs={logs} fields={groupedLabels[group]} search={search} />
                <LogLineDetailsFields log={log} logs={logs} fields={fieldsWithoutLinks} search={search} />
              </LogLineDetailsCollapsible>
            ) : (
              <LogLineDetailsCollapsible id={group} key={group} label={group}>
                <LogLineDetailsLabelFields log={log} logs={logs} fields={groupedLabels[group]} search={search} />
              </LogLineDetailsCollapsible>
            )
          )}
          {!labelGroups.length && fieldsWithoutLinks.length > 0 && (
            <LogLineDetailsCollapsible
              id="fields"
              key="fields"
              label={t('logs.log-line-details.fields-section', 'Fields')}
            >
              <LogLineDetailsFields log={log} logs={logs} fields={fieldsWithoutLinks} search={search} />
            </LogLineDetailsCollapsible>
          )}
          {noDetails && (
            <Box marginTop={1} paddingLeft={0.5}>
              <Trans i18nKey="logs.log-line-details.no-details">No fields to display.</Trans>
            </Box>
          )}
        </div>
      </div>
    );
  }
);
LogLineDetailsLegacyComponent.displayName = 'LogLineDetailsLegacyComponent';

const getStyles = (theme: GrafanaTheme2) => ({
  errorContainer: css({
    margin: theme.spacing(0, 0.5, 1, 0.5),
  }),
  componentWrapper: css({
    paddingBottom: theme.spacing(1),
  }),
  details: css({
    padding: theme.spacing(0, 1),
  }),
});
