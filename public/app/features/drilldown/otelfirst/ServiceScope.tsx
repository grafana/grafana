import { css } from '@emotion/css';
import { useEffect, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Alert, Badge, Button, LinkButton, LoadingPlaceholder, Stack, Text, useStyles2 } from '@grafana/ui';
import { useNavModel } from 'app/core/hooks/useNavModel';

import { AttributeDrawer } from './AttributeDrawer';
import { type AppId, getAppUrls, scopedAppUrl } from './appUrls';
import { type HomeService } from './loadHome';
import {
  type ServiceScope as ServiceScopeData,
  formatLatency,
  formatPercent,
  loadServiceScope,
} from './loadServiceScope';

interface Props {
  service: HomeService;
  // Without it, the screen is a view of its own and has nowhere to go back to.
  onBack?: () => void;
  // Opens the attribute mapping drawer as soon as the screen shows.
  openMapping?: boolean;
}

type State = { kind: 'loading' } | { kind: 'ready'; data: ServiceScopeData } | { kind: 'error'; message: string };

// One service, one set of OTel resource attributes, and the four signals read with that scope.
export function ServiceScope({ service, onBack, openMapping = false }: Props) {
  const styles = useStyles2(getStyles);
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [mappingOpen, setMappingOpen] = useState(openMapping);
  const appUrls = getAppUrls(useNavModel('drilldown').node.children ?? []);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });
    loadServiceScope(service.name, service.namespace, service.version)
      .then((data) => !cancelled && setState({ kind: 'ready', data }))
      .catch((error: Error) => !cancelled && setState({ kind: 'error', message: error.message }));
    return () => {
      cancelled = true;
    };
  }, [service.name, service.namespace, service.version]);

  const notReported = t('drilldown-otel.scope.not-reported', 'not reported');
  const attributes = [
    { key: 'service.namespace', value: service.namespace || notReported, reported: Boolean(service.namespace) },
    { key: 'service.name', value: service.name, reported: true },
    // The lab span metrics carry no deployment_environment_name label.
    { key: 'deployment.environment.name', value: notReported, reported: false },
    { key: 'service.version', value: service.version || notReported, reported: Boolean(service.version) },
  ];

  return (
    <div className={styles.page}>
      <Stack direction="column" gap={1} alignItems="flex-start">
        {onBack && (
          <Button variant="secondary" fill="text" icon="arrow-left" onClick={onBack}>
            {t('drilldown-otel.scope.back', 'Back to overview')}
          </Button>
        )}
        <Text element="h2" variant="h2">
          {service.name}
        </Text>
      </Stack>

      <section className={styles.section}>
        <Stack direction="column" gap={0.25}>
          <Text element="h3" variant="h4">
            {t('drilldown-otel.scope.title', 'Scope')}
          </Text>
          <Text variant="bodySmall" color="secondary">
            {t('drilldown-otel.scope.subtitle', 'The same attributes drive every signal below')}
          </Text>
        </Stack>
        <Button
          variant="secondary"
          size="sm"
          icon="info-circle"
          onClick={() => setMappingOpen(true)}
          className={styles.mappingButton}
        >
          {t('drilldown-otel.scope.mapping', 'How this maps to each signal')}
        </Button>
        <div className={styles.chips}>
          {attributes.map((attribute) => (
            <span key={attribute.key} className={styles.chip}>
              <span className={styles.chipKey}>{attribute.key} =</span>
              <span className={attribute.reported ? undefined : styles.muted}>{attribute.value}</span>
            </span>
          ))}
        </div>
      </section>

      {mappingOpen && <AttributeDrawer service={service.name} onClose={() => setMappingOpen(false)} />}
      {state.kind === 'loading' && (
        <LoadingPlaceholder
          text={t('drilldown-otel.scope.loading', 'Reading the four signals for {{service}}', {
            service: service.name,
          })}
        />
      )}
      {state.kind === 'error' && (
        <Alert severity="error" title={t('drilldown-otel.scope.error', 'Could not query the OTel lab data sources')}>
          {state.message}
        </Alert>
      )}
      {state.kind === 'ready' && <ScopeBody data={state.data} appUrls={appUrls} />}
    </div>
  );
}

function ScopeBody({ data, appUrls }: { data: ServiceScopeData; appUrls: Partial<Record<AppId, string>> }) {
  const styles = useStyles2(getStyles);
  const { metrics, traces, logs } = data;
  const noData = t('drilldown-otel.scope.no-data', 'no data');

  return (
    <>
      <section className={styles.section}>
        <Text element="h3" variant="h4">
          {t('drilldown-otel.scope.changed', 'What changed against the previous 30 minutes')}
        </Text>
        <div className={styles.summary}>
          <SummaryLine
            signal={t('drilldown-otel.signals.metrics', 'Metrics')}
            text={t(
              'drilldown-otel.scope.metrics-change',
              'error rate {{before}} to {{now}}, p95 {{p95Before}} to {{p95Now}}',
              {
                before: formatPercent(metrics.errorRatePrev),
                now: formatPercent(metrics.errorRate),
                p95Before: formatLatency(metrics.p95Prev),
                p95Now: formatLatency(metrics.p95),
              }
            )}
          />
          <SummaryLine
            signal={t('drilldown-otel.signals.logs', 'Logs')}
            text={
              logs.perMinute === undefined || logs.lines.length === 0
                ? t('drilldown-otel.scope.no-logs', 'no log stream for this service')
                : t('drilldown-otel.scope.logs-change', '{{before}} lines per minute to {{now}}', {
                    before: Math.round(logs.perMinutePrev ?? 0),
                    now: Math.round(logs.perMinute),
                  })
            }
          />
          <SummaryLine
            signal={t('drilldown-otel.signals.traces', 'Traces')}
            text={
              traces.topErrorSpan
                ? t('drilldown-otel.scope.traces-change', '{{span}} holds {{share}}% of errors', {
                    span: traces.topErrorSpan.name,
                    share: Math.round(traces.topErrorSpan.share * 100),
                  })
                : t('drilldown-otel.scope.no-errors', 'no error spans in this window')
            }
          />
          <SummaryLine
            signal={t('drilldown-otel.signals.profiles', 'Profiles')}
            text={t('drilldown-otel.scope.no-source', 'no data source')}
          />
        </div>
      </section>

      <div className={styles.panels}>
        <SignalPanel
          title={t('drilldown-otel.signals.metrics', 'Metrics')}
          source="Prometheus"
          url={appUrls.metrics && scopedAppUrl('metrics', appUrls.metrics, data.name)}
          headline={formatPercent(metrics.errorRate)}
          detail={t('drilldown-otel.scope.metrics-detail', 'error rate, p95 {{p95}}', {
            p95: formatLatency(metrics.p95),
          })}
          query={data.queries.metrics}
        />
        <SignalPanel
          title={t('drilldown-otel.signals.traces', 'Traces')}
          source="Tempo"
          url={appUrls.traces && scopedAppUrl('traces', appUrls.traces, data.name)}
          headline={String(traces.errorTraces)}
          detail={t('drilldown-otel.scope.traces-detail', 'error traces in the last 30 minutes')}
          query={data.queries.traces}
        />
        <SignalPanel
          title={t('drilldown-otel.signals.logs', 'Logs')}
          source="Loki"
          url={appUrls.logs && scopedAppUrl('logs', appUrls.logs, data.name)}
          headline={logs.perMinute === undefined ? noData : String(Math.round(logs.perMinute))}
          detail={t('drilldown-otel.scope.logs-detail', 'lines per minute')}
          query={data.queries.logs}
        >
          {logs.lines.map((line, index) => (
            <div key={index} className={styles.logLine}>
              <Badge
                color={line.level === 'error' ? 'red' : line.level === 'warn' ? 'orange' : 'blue'}
                text={line.level || 'log'}
              />
              <span className={styles.muted}>{line.time}</span>
              <span className={styles.logText}>{line.line}</span>
            </div>
          ))}
        </SignalPanel>
        <SignalPanel
          title={t('drilldown-otel.signals.profiles', 'Profiles')}
          source="Pyroscope"
          headline={t('drilldown-otel.scope.no-profiles', 'No profiles data source')}
          detail={t(
            'drilldown-otel.scope.profiles-detail',
            'Profiles Drilldown reads only service_name. Connect a Pyroscope data source to see CPU and memory for this service.'
          )}
        />
      </div>

      <section className={styles.section}>
        <Stack direction="column" gap={0.25}>
          <Text element="h3" variant="h4">
            {t('drilldown-otel.scope.compare', 'Errors compared with the rest')}
          </Text>
          <Text variant="bodySmall" color="secondary">
            {t(
              'drilldown-otel.scope.compare-subtitle',
              'Attribute values ranked by their share of errors against their share of all spans'
            )}
          </Text>
        </Stack>
        {data.comparison.length === 0 && (
          <Text color="secondary">
            {t('drilldown-otel.scope.compare-empty', 'No errors in this window to compare.')}
          </Text>
        )}
        {data.comparison.map((row) => (
          <div key={`${row.attribute}-${row.value}`} className={styles.compareRow}>
            <span className={styles.muted}>{row.attribute}</span>
            <Text weight="medium">{row.value || '-'}</Text>
            <span className={row.points >= 0 ? styles.up : styles.down}>
              {t('drilldown-otel.scope.points', '{{points}} pts', {
                points: `${row.points >= 0 ? '+' : ''}${Math.round(row.points)}`,
              })}
            </span>
          </div>
        ))}
      </section>
    </>
  );
}

function SummaryLine({ signal, text }: { signal: string; text: string }) {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.summaryLine}>
      <Text weight="medium">{signal}</Text>
      <Text color="secondary">{text}</Text>
    </div>
  );
}

interface PanelProps {
  title: string;
  source: string;
  url?: string;
  headline: string;
  detail: string;
  query?: string;
  children?: React.ReactNode;
}

function SignalPanel({ title, source, url, headline, detail, query, children }: PanelProps) {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.panel}>
      <Stack justifyContent="space-between" alignItems="center">
        <Stack gap={1} alignItems="center">
          <Text weight="medium">{title}</Text>
          <Text variant="bodySmall" color="secondary">
            {source}
          </Text>
        </Stack>
        {url && (
          <LinkButton href={url} size="sm" variant="secondary" fill="text" icon="external-link-alt">
            {t('drilldown-otel.scope.open', 'Open {{app}} Drilldown', { app: title })}
          </LinkButton>
        )}
      </Stack>
      <Text variant="h3">{headline}</Text>
      <Text variant="bodySmall" color="secondary">
        {detail}
      </Text>
      {children}
      {query && <code className={styles.query}>{query}</code>}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  const box = {
    background: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
  };
  return {
    page: css({ display: 'flex', flexDirection: 'column', gap: theme.spacing(3) }),
    section: css({ display: 'flex', flexDirection: 'column', gap: theme.spacing(1.5) }),
    mappingButton: css({ alignSelf: 'flex-start' }),
    chips: css({ display: 'flex', flexWrap: 'wrap', gap: theme.spacing(1) }),
    chip: css({
      ...box,
      display: 'inline-flex',
      gap: theme.spacing(0.75),
      padding: theme.spacing(0.5, 1.25),
      fontSize: theme.typography.bodySmall.fontSize,
    }),
    chipKey: css({ color: theme.colors.text.secondary }),
    muted: css({ color: theme.colors.text.secondary }),
    summary: css({ ...box, display: 'flex', flexDirection: 'column', padding: theme.spacing(1, 2) }),
    summaryLine: css({
      display: 'grid',
      gridTemplateColumns: '100px 1fr',
      gap: theme.spacing(1),
      padding: theme.spacing(0.5, 0),
    }),
    panels: css({
      display: 'grid',
      gap: theme.spacing(2),
      gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    }),
    panel: css({
      ...box,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      gap: theme.spacing(0.75),
      padding: theme.spacing(1.5, 2),
      minWidth: 0,
    }),
    logLine: css({ display: 'flex', gap: theme.spacing(1), alignItems: 'center', maxWidth: '100%' }),
    logText: css({
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      fontFamily: theme.typography.fontFamilyMonospace,
      fontSize: theme.typography.bodySmall.fontSize,
    }),
    query: css({
      maxWidth: '100%',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
    }),
    compareRow: css({
      ...box,
      display: 'grid',
      gridTemplateColumns: '160px 1fr 80px',
      gap: theme.spacing(1),
      padding: theme.spacing(1, 2),
      alignItems: 'center',
    }),
    up: css({ color: theme.colors.error.text, textAlign: 'right' }),
    down: css({ color: theme.colors.success.text, textAlign: 'right' }),
  };
};
