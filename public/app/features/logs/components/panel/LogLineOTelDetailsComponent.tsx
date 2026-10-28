import { css } from '@emotion/css';
import { type JSX, useEffect, useMemo } from 'react';

import { DataFrameType, type GrafanaTheme2, type TimeRange } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Box, Icon, InlineField, InlineSwitch, Stack, useStyles2 } from '@grafana/ui';

import { OTEL_LOG_LINE_ATTRIBUTES_FIELD_NAME } from '../fieldSelector/logFields';
import { type FieldDef } from '../logParser';
import { ServiceHexagonIcon } from '../otel/ServiceHexagonIcon';
import {
  groupOTelAttributes,
  type OTelAttributeCategory,
  SERVICE_HEXAGON_CATEGORY_ICON,
  type GroupedOTelAttributes,
} from '../otel/details';
import { useAttributesExtensionLinks } from '../useAttributesExtensionLinks';

import { LogLineDetailsCollapsible } from './LogLineDetailsCollapsible';
import { LogLineDetailsError } from './LogLineDetailsError';
import { filterFields, filterLabels, type LabelWithLinks } from './LogLineDetailsFields';
import { LogLineDetailsLog } from './LogLineDetailsLog';
import { LogLineDetailsSummary } from './LogLineDetailsSummary';
import { LogLineDetailsTrace } from './LogLineDetailsTrace';
import { LogLineOTelDetailsFields, LogLineOTelDetailsLabelFields } from './LogLineOTelDetailsFields';
import { useLogListContext } from './LogListContext';
import { getTempoTraceFromLinks } from './links';
import { type LogListModel } from './processing';

interface LogLineDetailsOTelComponentProps {
  log: LogListModel;
  logs: LogListModel[];
  prettifyDetailsJSON: boolean;
  search?: string;
  setPrettifyDetailsJSON: (prettifyDetailsJSON: boolean) => void;
  timeRange: TimeRange;
  timeZone: string;
}

export const LogLineDetailsOTelComponent = ({
  log,
  logs,
  prettifyDetailsJSON,
  search = '',
  setPrettifyDetailsJSON,
  timeRange,
  timeZone,
}: LogLineDetailsOTelComponentProps) => {
  const { app, noInteractions } = useLogListContext();
  const extensionLinks = useAttributesExtensionLinks(log, timeRange);

  useEffect(() => {
    if (noInteractions) {
      return;
    }
    reportInteraction('logs_log_line_details_otel_displayed', {
      app,
      language: log.otelLanguage,
    });
  }, [app, log.otelLanguage, log.uid, noInteractions]);

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
        .filter((label) => label !== OTEL_LOG_LINE_ATTRIBUTES_FIELD_NAME)
        .sort()
        .map((label) => ({
          key: label,
          value: log.labels[label],
          links: extensionLinks?.[label],
        })),
    [extensionLinks, log.labels]
  );

  const groupedFields = useMemo(
    () => groupOTelAttributes(fieldsWithoutLinks, (field) => field.keys[0] ?? ''),
    [fieldsWithoutLinks]
  );
  const groupedLabels = useMemo(() => groupOTelAttributes(labelsWithLinks, (label) => label.key), [labelsWithLinks]);
  const trace = useMemo(
    () =>
      getTempoTraceFromLinks(
        log.fields.filter((field) => field.links?.length && field.fieldIndex !== log.entryFieldIndex)
      ),
    [log.entryFieldIndex, log.fields]
  );

  return (
    <LogLineDetailsOTelComponentBody
      fields={fieldsWithoutLinks}
      groupedFields={groupedFields}
      groupedLabels={groupedLabels}
      labels={labelsWithLinks}
      log={log}
      logs={logs}
      prettifyDetailsJSON={prettifyDetailsJSON}
      search={search}
      setPrettifyDetailsJSON={setPrettifyDetailsJSON}
      timeRange={timeRange}
      timeZone={timeZone}
      trace={trace}
    />
  );
};

interface LogLineDetailsOTelComponentBodyProps {
  fields: FieldDef[];
  groupedFields: Array<GroupedOTelAttributes<FieldDef>>;
  groupedLabels: Array<GroupedOTelAttributes<LabelWithLinks>>;
  labels: LabelWithLinks[];
  log: LogListModel;
  logs: LogListModel[];
  prettifyDetailsJSON: boolean;
  search: string;
  setPrettifyDetailsJSON: (prettifyDetailsJSON: boolean) => void;
  timeRange: TimeRange;
  timeZone: string;
  trace: ReturnType<typeof getTempoTraceFromLinks>;
}

const LogLineDetailsOTelComponentBody = ({
  fields,
  groupedFields,
  groupedLabels,
  labels,
  log,
  logs,
  prettifyDetailsJSON,
  search,
  setPrettifyDetailsJSON,
  timeRange,
  timeZone,
  trace,
}: LogLineDetailsOTelComponentBodyProps) => {
  const { syntaxHighlighting, syntaxHighlightingUnavailable } = useLogListContext();
  const styles = useStyles2(getStyles);
  const hasAttributes = groupedFields.length > 0 || groupedLabels.length > 0;

  useEffect(() => {
    if (syntaxHighlightingUnavailable) {
      setPrettifyDetailsJSON(false);
    }
  }, [setPrettifyDetailsJSON, syntaxHighlightingUnavailable]);

  return (
    <div className={styles.componentWrapper}>
      <LogLineDetailsSummary log={log} />
      <div className={styles.container}>
        <div className={styles.categories}>
          <LogLineDetailsCollapsible
            defaultExpanded={false}
            id="log-line"
            label={t('logs.log-line-details.log-line-section', 'Log line')}
          >
            {log.body && log.isJSON && (
              <Stack alignItems="center" justifyContent="flex-end">
                <InlineField label={t('logs.log-line-details.prettify', 'Prettify')}>
                  <InlineSwitch
                    value={prettifyDetailsJSON}
                    onChange={(event) => setPrettifyDetailsJSON(event.currentTarget.checked)}
                  />
                </InlineField>
              </Stack>
            )}
            <LogLineDetailsLog
              log={log}
              prettifyJSON={prettifyDetailsJSON}
              syntaxHighlighting={syntaxHighlighting ?? true}
            />
          </LogLineDetailsCollapsible>
          {trace && (
            <LogLineDetailsCollapsible
              defaultExpanded={false}
              id="trace"
              label={t('logs.log-line-details.trace-section', 'Trace')}
            >
              <LogLineDetailsTrace timeRange={timeRange} timeZone={timeZone} traceRef={trace} />
            </LogLineDetailsCollapsible>
          )}
        </div>
        {hasAttributes ? (
          <>
            <LogLineDetailsError className={styles.errorContainer} fields={fields} labels={labels} />
            <div className={styles.categories}>
              {groupedFields.length > 0 &&
                groupedFields.map(({ category, items }) => (
                  <OTelCategory<FieldDef>
                    key={category.id}
                    category={category}
                    items={items}
                    filter={filterFields}
                    log={log}
                    logs={logs}
                    search={search}
                    RenderFields={LogLineOTelDetailsFields}
                  />
                ))}
              {groupedLabels.length > 0 &&
                groupedLabels.map(({ category, items }) => (
                  <OTelCategory<LabelWithLinks>
                    key={category.id}
                    category={category}
                    items={items}
                    filter={filterLabels}
                    log={log}
                    logs={logs}
                    search={search}
                    RenderFields={LogLineOTelDetailsLabelFields}
                  />
                ))}
            </div>
          </>
        ) : (
          <Box marginTop={1} paddingLeft={0.5}>
            <Trans i18nKey="logs.log-line-details.no-details">No fields to display.</Trans>
          </Box>
        )}
      </div>
    </div>
  );
};

function OTelCategory<T>({
  category,
  filter,
  items,
  log,
  logs,
  RenderFields,
  search,
}: {
  category: OTelAttributeCategory;
  filter: (f: T[], s: string) => T[];
  items: T[];
  log: LogListModel;
  logs: LogListModel[];
  RenderFields: (props: { fields: T[]; log: LogListModel; logs: LogListModel[] }) => JSX.Element | null;
  search?: string;
}) {
  const { fontSize } = useLogListContext();
  const styles = useStyles2(getStyles);
  const label = t(category.labelKey, category.defaultLabel);
  const filteredItems = useMemo(() => (search !== undefined ? filter(items, search) : items), [filter, items, search]);

  if (!items.length) {
    return null;
  }

  const icon =
    category.icon === SERVICE_HEXAGON_CATEGORY_ICON ? (
      <ServiceHexagonIcon />
    ) : (
      <Icon name={category.icon} size={fontSize === 'small' ? 'md' : 'lg'} />
    );

  return (
    <LogLineDetailsCollapsible count={filteredItems.length} icon={icon} id={category.id} label={label}>
      {!filteredItems.length && (
        <div className={styles.componentWrapper}>
          <Box marginTop={1} paddingLeft={0.5}>
            <Trans i18nKey="logs.log-line-details.search.no-results">No matching results.</Trans>
          </Box>
        </div>
      )}
      <RenderFields log={log} logs={logs} fields={filteredItems} />
    </LogLineDetailsCollapsible>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  componentWrapper: css({
    background: theme.colors.background.primary,
    padding: theme.spacing(0, 0.5, 0, 0.5),
  }),
  container: css({
    textOverflow: 'ellipsis',
  }),
  errorContainer: css({
    margin: theme.spacing(1.5, 1, 1, 1),
  }),
  categories: css({
    padding: `0 ${theme.spacing(0.5)}`,
  }),
});
