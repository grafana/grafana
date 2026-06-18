import { css } from '@emotion/css';
import { useState } from 'react';

import {
  type DataQueryError,
  type ErrorsAndNoticesInspectorProps,
  type GrafanaTheme2,
  type QueryResultMetaNotice,
  textUtil,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { type PromOptions, type PromQuery, type PrometheusDatasource } from '@grafana/prometheus';
import { ClipboardButton, Icon, type IconName, Stack, TextLink, useStyles2 } from '@grafana/ui';

type Props = ErrorsAndNoticesInspectorProps<PrometheusDatasource, PromQuery, PromOptions>;

type Severity = QueryResultMetaNotice['severity'];

interface InspectableEntry {
  severity: Severity;
  title: string;
  content: string;
  link?: string;
}

// Higher number = higher priority, used to sort cards error > warning > info.
const SEVERITY_RANK: Record<Severity, number> = {
  error: 3,
  warning: 2,
  info: 1,
};

const SEVERITY_LABELS: Record<Severity, () => string> = {
  error: () => t('grafana-prometheus.errors-and-notices-inspector.severity-error', 'Error'),
  warning: () => t('grafana-prometheus.errors-and-notices-inspector.severity-warning', 'Warning'),
  info: () => t('grafana-prometheus.errors-and-notices-inspector.severity-info', 'Info'),
};

function getSeverityIcon(severity: Severity): IconName {
  return severity === 'info' ? 'info-circle' : 'exclamation-triangle';
}

function formatError(error: DataQueryError): string {
  const payload = error.data ?? error;
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return error.message ?? String(error);
  }
}

function buildEntries(data: Props['data'], errors: DataQueryError[] | undefined): InspectableEntry[] {
  const entries: InspectableEntry[] = [];

  for (const error of errors ?? []) {
    entries.push({
      severity: 'error',
      title: error.message ?? error.data?.message ?? SEVERITY_LABELS.error(),
      content: formatError(error),
    });
  }

  const seen = new Set<string>();
  for (const frame of data ?? []) {
    for (const notice of frame.meta?.notices ?? []) {
      const severity: Severity = notice.severity ?? 'info';
      const key = `${severity}:${notice.text}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      entries.push({
        severity,
        title: notice.text,
        content: notice.text,
        link: notice.link,
      });
    }
  }

  // Sort by severity so errors come first, then warnings, then info.
  return entries.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
}

export function ErrorsAndNoticesInspector({ data, errors }: Props) {
  const styles = useStyles2(getStyles);
  const entries = buildEntries(data, errors);

  if (entries.length === 0) {
    return (
      <div className={styles.empty}>
        {t('grafana-prometheus.errors-and-notices-inspector.no-issues', 'No errors or notices for this query.')}
      </div>
    );
  }

  return (
    <Stack direction="column" gap={1}>
      {entries.map((entry, index) => (
        <EntryCard key={`${entry.severity}-${index}`} entry={entry} />
      ))}
    </Stack>
  );
}

function EntryCard({ entry }: { entry: InspectableEntry }) {
  const styles = useStyles2(getStyles);
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <button
          type="button"
          className={styles.toggle}
          onClick={() => setIsOpen((open) => !open)}
          aria-expanded={isOpen}
          aria-label={entry.title}
        >
          <Icon name={isOpen ? 'angle-up' : 'angle-down'} className={styles.chevron} />
          <Icon name={getSeverityIcon(entry.severity)} className={styles[entry.severity]} />
          <span className={styles.severityLabel}>{SEVERITY_LABELS[entry.severity]()}</span>
        </button>
        <ClipboardButton size="sm" variant="secondary" fill="text" icon="clipboard-alt" getText={() => entry.content}>
          {t('grafana-prometheus.errors-and-notices-inspector.copy', 'Copy to clipboard')}
        </ClipboardButton>
      </div>

      {isOpen && (
        <div className={styles.body}>
          <pre className={styles.code}>{entry.content}</pre>
          {entry.link && (
            <TextLink href={textUtil.sanitizeUrl(entry.link)} external className={styles.link}>
              {t('grafana-prometheus.errors-and-notices-inspector.learn-more', 'Learn more')}
            </TextLink>
          )}
        </div>
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  empty: css({
    color: theme.colors.text.secondary,
    padding: theme.spacing(2),
  }),
  card: css({
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    backgroundColor: theme.colors.background.secondary,
    overflow: 'hidden',
  }),
  header: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    width: '100%',
    padding: theme.spacing(0.5, 1, 0.5, 1.5),

    '&:hover': {
      background: theme.colors.action.hover,
    },
  }),
  toggle: css({
    display: 'flex',
    flexGrow: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1, 0),
    background: 'transparent',
    border: 'none',
    textAlign: 'left',
    cursor: 'pointer',
  }),
  severityLabel: css({
    fontWeight: theme.typography.fontWeightMedium,
    flexShrink: 0,
  }),
  chevron: css({
    flexShrink: 0,
    color: theme.colors.text.secondary,
  }),
  body: css({
    borderTop: `1px solid ${theme.colors.border.weak}`,
    padding: theme.spacing(1.5),
  }),
  code: css({
    margin: 0,
    padding: theme.spacing(1.5),
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
    backgroundColor: theme.colors.background.canvas,
    borderRadius: theme.shape.radius.default,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    overflowX: 'auto',
  }),
  link: css({
    display: 'inline-block',
    marginTop: theme.spacing(1),
  }),
  error: css({
    color: theme.colors.error.text,
    flexShrink: 0,
  }),
  warning: css({
    color: theme.colors.warning.text,
    flexShrink: 0,
  }),
  info: css({
    color: theme.colors.info.text,
    flexShrink: 0,
  }),
});
