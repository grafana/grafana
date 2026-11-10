import { css } from '@emotion/css';
import { useCallback, useEffect, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  Alert,
  Badge,
  Button,
  ClipboardButton,
  Combobox,
  Field,
  InlineField,
  InlineSwitch,
  LinkButton,
  LoadingPlaceholder,
  RadioButtonGroup,
  Stack,
  Text,
  useStyles2,
} from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { useNavModel } from 'app/core/hooks/useNavModel';

import { getFallbackNavModel } from '../realdata/RealDrilldownPage';
import { formatMs } from '../realdata/loadScenario';

import { getAppUrls, scopedAppUrl } from './appUrls';
import { type HomeService, loadHome } from './loadHome';
import {
  type LogScope,
  type TraceData,
  type TraceLog,
  type TraceSpanRow,
  findTrace,
  loadTrace,
  loadTraceLogs,
} from './loadTrace';

const MAX_SPANS = 25;
const WARN_AND_ABOVE = ['warn', 'warning', 'error', 'err', 'fatal', 'critical'];

type HomeState = { kind: 'loading' } | { kind: 'ready'; services: HomeService[] } | { kind: 'error'; message: string };
type TraceState =
  | { kind: 'loading' }
  | { kind: 'none' }
  | { kind: 'ready'; trace: TraceData; failing: boolean }
  | { kind: 'error'; message: string };

// OTel-first wireframe 4: from a service to its failing trace to the logs of every service in that trace.
export function OtelFirstTraceView() {
  const hasNav = useNavModel('drilldown').node.id !== 'not-found';
  const [home, setHome] = useState<HomeState>({ kind: 'loading' });
  const [name, setName] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    loadHome()
      .then((data) => !cancelled && setHome({ kind: 'ready', services: data.services }))
      .catch((error: Error) => !cancelled && setHome({ kind: 'error', message: error.message }));
    return () => {
      cancelled = true;
    };
  }, []);

  const services = home.kind === 'ready' ? home.services : [];
  // The service that changed most comes first, so it is the default pick.
  const selected = services.find((service) => service.name === name) ?? services[0];

  return (
    <Page navId={hasNav ? 'drilldown' : undefined} navModel={hasNav ? undefined : getFallbackNavModel()}>
      <Page.Contents>
        {home.kind === 'loading' && (
          <LoadingPlaceholder text={t('drilldown-otel.loading', 'Querying the OTel lab data sources')} />
        )}
        {home.kind === 'error' && (
          <Alert severity="error" title={t('drilldown-otel.error', 'Could not query the OTel lab data sources')}>
            {home.message}
          </Alert>
        )}
        {home.kind === 'ready' && selected && (
          <Stack direction="column" gap={3}>
            <Field noMargin label={t('drilldown-otel.view.service', 'Service')}>
              <Combobox
                width={32}
                value={selected.name}
                options={services.map((service) => ({ label: service.name, value: service.name }))}
                onChange={(option) => setName(option?.value)}
              />
            </Field>
            <TraceBody key={selected.name} service={selected} />
          </Stack>
        )}
      </Page.Contents>
    </Page>
  );
}

function TraceBody({ service }: { service: HomeService }) {
  const styles = useStyles2(getStyles);
  const appUrls = getAppUrls(useNavModel('drilldown').node.children ?? []);
  const [state, setState] = useState<TraceState>({ kind: 'loading' });
  const [selectedSpan, setSelectedSpan] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    findTrace(service.name)
      .then(async (found) => {
        if (!found) {
          return !cancelled && setState({ kind: 'none' });
        }
        const trace = await loadTrace(found.traceId);
        if (!cancelled) {
          setState({ kind: 'ready', trace, failing: found.failing });
          setSelectedSpan(trace.spans[0]?.spanId);
        }
      })
      .catch((error: Error) => !cancelled && setState({ kind: 'error', message: error.message }));
    return () => {
      cancelled = true;
    };
  }, [service.name]);

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <Stack direction="column" gap={3}>
      <Stack gap={2} wrap="wrap">
        <LinkButton variant="secondary" fill="text" href="/drilldown?version=otel-first&view=scope">
          {t('drilldown-otel.trace.step-symptom', '1 Symptom')}
        </LinkButton>
        <LinkButton variant="secondary" fill="text" href="/drilldown?version=otel-first&view=scope">
          {t('drilldown-otel.trace.step-compare', '2 Compare errors with the rest')}
        </LinkButton>
        <Button variant="secondary" fill="text" onClick={() => scrollTo('otel-trace-section')}>
          {t('drilldown-otel.trace.step-trace', '3 Failing trace')}
        </Button>
        <Button variant="secondary" fill="text" onClick={() => scrollTo('otel-trace-logs')}>
          {t('drilldown-otel.trace.step-logs', '4 Logs of the trace')}
        </Button>
      </Stack>

      {state.kind === 'loading' && (
        <LoadingPlaceholder
          text={t('drilldown-otel.trace.loading', 'Finding a trace for {{service}}', { service: service.name })}
        />
      )}
      {state.kind === 'error' && (
        <Alert severity="error" title={t('drilldown-otel.trace.error', 'Could not read the trace')}>
          {state.message}
        </Alert>
      )}
      {state.kind === 'none' && (
        <Alert severity="info" title={t('drilldown-otel.trace.none', 'No trace found')}>
          {t('drilldown-otel.trace.none-body', 'Tempo has no trace for {{service}} in the last 30 minutes.', {
            service: service.name,
          })}
        </Alert>
      )}
      {state.kind === 'ready' && (
        <TraceContent
          service={service}
          trace={state.trace}
          failing={state.failing}
          selectedSpan={selectedSpan}
          onSelectSpan={setSelectedSpan}
          tracesUrl={appUrls.traces && scopedAppUrl('traces', appUrls.traces, service.name)}
          logsUrl={appUrls.logs && scopedAppUrl('logs', appUrls.logs, service.name)}
          metricsUrl={appUrls.metrics && scopedAppUrl('metrics', appUrls.metrics, service.name)}
          styles={styles}
        />
      )}
    </Stack>
  );
}

interface ContentProps {
  service: HomeService;
  trace: TraceData;
  failing: boolean;
  selectedSpan?: string;
  onSelectSpan: (spanId: string) => void;
  tracesUrl?: string;
  logsUrl?: string;
  metricsUrl?: string;
  styles: ReturnType<typeof getStyles>;
}

function TraceContent({
  service,
  trace,
  failing,
  selectedSpan,
  onSelectSpan,
  tracesUrl,
  logsUrl,
  metricsUrl,
  styles,
}: ContentProps) {
  const span = trace.spans.find((row) => row.spanId === selectedSpan) ?? trace.spans[0];
  const errored = trace.spans.filter((row) => row.error).length;
  const shown = trace.spans.slice(0, MAX_SPANS);

  return (
    <>
      <section className={styles.section}>
        <div className={styles.chips}>
          <Chip name="service.name" value={service.name} />
          <Chip name="trace_id" value={trace.traceId} />
          {span && <Chip name="span" value={span.name} />}
          <ClipboardButton getText={() => trace.traceId} variant="secondary" size="sm" icon="copy">
            {t('drilldown-otel.trace.copy', 'Copy trace ID')}
          </ClipboardButton>
        </div>
      </section>

      <section id="otel-trace-section" className={styles.section}>
        <Stack justifyContent="space-between" alignItems="center">
          <Stack direction="column" gap={0.25}>
            <Text element="h3" variant="h4">
              {t('drilldown-otel.trace.title', 'Trace')}
            </Text>
            <Text variant="bodySmall" color="secondary">
              {failing
                ? t(
                    'drilldown-otel.trace.subtitle-failing',
                    'Errored spans first. {{errors}} of {{spans}} spans errored.',
                    {
                      errors: errored,
                      spans: trace.spans.length,
                    }
                  )
                : t(
                    'drilldown-otel.trace.subtitle-ok',
                    'No error trace for this service in the last 30 minutes. Showing its newest trace. Spans in start order.'
                  )}
            </Text>
          </Stack>
          {tracesUrl && (
            <LinkButton href={tracesUrl} size="sm" variant="secondary" icon="external-link-alt">
              {t('drilldown-otel.trace.open-traces', 'Open in Traces Drilldown')}
            </LinkButton>
          )}
        </Stack>
        <div className={styles.spans}>
          {shown.map((row) => (
            <SpanRow
              key={row.spanId}
              row={row}
              total={trace.durationMs}
              selected={row.spanId === span?.spanId}
              onSelect={() => onSelectSpan(row.spanId)}
              styles={styles}
            />
          ))}
        </div>
        {trace.spans.length > shown.length && (
          <Text variant="bodySmall" color="secondary">
            {t(
              'drilldown-otel.trace.more',
              'Showing {{shown}} of {{total}} spans. Services in this trace: {{services}}.',
              {
                shown: shown.length,
                total: trace.spans.length,
                services: trace.services.join(', '),
              }
            )}
          </Text>
        )}
      </section>

      <TraceLogs
        trace={trace}
        span={span}
        logsUrl={logsUrl}
        metricsUrl={metricsUrl}
        service={service.name}
        styles={styles}
      />
    </>
  );
}

function Chip({ name, value }: { name: string; value: string }) {
  const styles = useStyles2(getStyles);
  return (
    <span className={styles.chip}>
      <span className={styles.muted}>{name} =</span>
      <span className={styles.chipValue}>{value}</span>
    </span>
  );
}

interface SpanRowProps {
  row: TraceSpanRow;
  total: number;
  selected: boolean;
  onSelect: () => void;
  styles: ReturnType<typeof getStyles>;
}

function SpanRow({ row, total, selected, onSelect, styles }: SpanRowProps) {
  const left = total > 0 ? Math.min(100, (row.offsetMs / total) * 100) : 0;
  const width = total > 0 ? Math.max(1, Math.min(100 - left, (row.durationMs / total) * 100)) : 100;
  return (
    <button type="button" className={selected ? styles.spanSelected : styles.span} onClick={onSelect}>
      <span className={styles.spanService}>{row.service}</span>
      <span className={styles.spanName}>{row.name}</span>
      <span className={styles.spanBar}>
        <span className={row.error ? styles.barError : styles.bar} style={{ left: `${left}%`, width: `${width}%` }} />
      </span>
      <span className={styles.spanDuration}>{formatMs(row.durationMs)}</span>
    </button>
  );
}

interface LogsProps {
  trace: TraceData;
  span?: TraceSpanRow;
  service: string;
  logsUrl?: string;
  metricsUrl?: string;
  styles: ReturnType<typeof getStyles>;
}

type LogsState = { kind: 'loading' } | { kind: 'ready'; logs: TraceLog[] } | { kind: 'error'; message: string };

function TraceLogs({ trace, span, service, logsUrl, metricsUrl, styles }: LogsProps) {
  const [scope, setScope] = useState<LogScope>('trace');
  const [warnOnly, setWarnOnly] = useState(false);
  const [state, setState] = useState<LogsState>({ kind: 'loading' });

  const load = useCallback(() => {
    let cancelled = false;
    setState({ kind: 'loading' });
    loadTraceLogs(trace, scope, span)
      .then((logs) => !cancelled && setState({ kind: 'ready', logs }))
      .catch((error: Error) => !cancelled && setState({ kind: 'error', message: error.message }));
    return () => {
      cancelled = true;
    };
  }, [trace, scope, span]);

  useEffect(() => load(), [load]);

  const logs =
    state.kind === 'ready'
      ? state.logs.filter((log) => !warnOnly || WARN_AND_ABOVE.includes(log.level.toLowerCase()))
      : [];

  return (
    <section id="otel-trace-logs" className={styles.section}>
      <Stack direction="column" gap={0.25}>
        <Text element="h3" variant="h4">
          {t('drilldown-otel.trace.logs-title', 'Logs for this trace')}
        </Text>
        <Text variant="bodySmall" color="secondary">
          {t('drilldown-otel.trace.logs-subtitle', 'Lines from every service in the trace')}
        </Text>
      </Stack>
      <Stack gap={2} alignItems="center" wrap="wrap">
        <RadioButtonGroup
          value={scope}
          onChange={setScope}
          options={[
            { label: t('drilldown-otel.trace.scope-trace', 'Trace'), value: 'trace' },
            { label: t('drilldown-otel.trace.scope-resource', 'Resource'), value: 'resource' },
            { label: t('drilldown-otel.trace.scope-both', 'Resource and Trace'), value: 'resource-trace' },
            { label: t('drilldown-otel.trace.scope-span', 'Span'), value: 'span' },
          ]}
        />
        <InlineField label={t('drilldown-otel.trace.warn-only', 'Show only WARN and above')}>
          <InlineSwitch value={warnOnly} onChange={(event) => setWarnOnly(event.currentTarget.checked)} />
        </InlineField>
      </Stack>
      <Text variant="bodySmall" color="secondary">
        {t(
          'drilldown-otel.trace.scope-note',
          "Trace is the default. Resource adds the service's logs within 30 minutes of the span. Span shows lines for the selected span."
        )}
      </Text>
      {state.kind === 'loading' && <LoadingPlaceholder text={t('drilldown-otel.trace.logs-loading', 'Reading logs')} />}
      {state.kind === 'error' && (
        <Alert severity="error" title={t('drilldown-otel.trace.logs-error', 'Could not read the logs')}>
          {state.message}
        </Alert>
      )}
      {state.kind === 'ready' && logs.length === 0 && (
        <Text color="secondary">
          {t('drilldown-otel.trace.logs-empty', 'No log lines in this scope. Try another scope.')}
        </Text>
      )}
      {logs.length > 0 && (
        <div className={styles.logs}>
          {logs.map((log, index) => (
            <div key={`${log.timeNs}-${index}`} className={styles.logLine}>
              <span className={styles.muted}>
                {new Date(Number(log.timeNs.slice(0, -6))).toLocaleTimeString([], { hour12: false })}
              </span>
              <Badge
                color={
                  WARN_AND_ABOVE.slice(2).includes(log.level.toLowerCase())
                    ? 'red'
                    : log.level.toLowerCase().startsWith('warn')
                      ? 'orange'
                      : 'blue'
                }
                text={log.level || 'log'}
              />
              <span className={styles.logService}>{log.service}</span>
              <span className={styles.logText}>{log.line}</span>
            </div>
          ))}
        </div>
      )}
      <Stack gap={1} wrap="wrap">
        {logsUrl && (
          <LinkButton href={logsUrl} size="sm" variant="secondary" icon="external-link-alt">
            {t('drilldown-otel.trace.open-logs', 'Open in Logs Drilldown')}
          </LinkButton>
        )}
        {metricsUrl && (
          <LinkButton href={metricsUrl} size="sm" variant="secondary" icon="external-link-alt">
            {t('drilldown-otel.trace.open-metrics', 'Open metrics for {{service}}', { service })}
          </LinkButton>
        )}
      </Stack>
    </section>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  const box = {
    background: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
  };
  const spanBase = {
    display: 'grid',
    gridTemplateColumns: '140px minmax(120px, 1fr) minmax(160px, 2fr) 80px',
    gap: theme.spacing(1),
    alignItems: 'center',
    padding: theme.spacing(0.75, 1.5),
    textAlign: 'left' as const,
    cursor: 'pointer',
    color: theme.colors.text.primary,
    background: 'transparent',
    border: 'none',
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    width: '100%',
  };
  return {
    section: css({ display: 'flex', flexDirection: 'column', gap: theme.spacing(1.5) }),
    chips: css({ display: 'flex', flexWrap: 'wrap', gap: theme.spacing(1), alignItems: 'center' }),
    chip: css({
      ...box,
      display: 'inline-flex',
      gap: theme.spacing(0.75),
      padding: theme.spacing(0.5, 1.25),
      fontSize: theme.typography.bodySmall.fontSize,
      maxWidth: '100%',
    }),
    chipValue: css({ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }),
    muted: css({ color: theme.colors.text.secondary }),
    spans: css({ ...box, display: 'flex', flexDirection: 'column', overflow: 'hidden' }),
    span: css({ ...spanBase, '&:hover': { background: theme.colors.action.hover } }),
    spanSelected: css({ ...spanBase, background: theme.colors.action.selected }),
    spanService: css({
      fontWeight: theme.typography.fontWeightMedium,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }),
    spanName: css({
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      color: theme.colors.text.secondary,
    }),
    spanBar: css({
      position: 'relative',
      height: theme.spacing(1.5),
      background: theme.colors.background.secondary,
      borderRadius: theme.shape.radius.default,
    }),
    bar: css({
      position: 'absolute',
      top: 0,
      bottom: 0,
      background: theme.colors.primary.main,
      borderRadius: theme.shape.radius.default,
    }),
    barError: css({
      position: 'absolute',
      top: 0,
      bottom: 0,
      background: theme.colors.error.main,
      borderRadius: theme.shape.radius.default,
    }),
    spanDuration: css({ textAlign: 'right', color: theme.colors.text.secondary }),
    logs: css({ ...box, display: 'flex', flexDirection: 'column', padding: theme.spacing(1) }),
    logLine: css({
      display: 'flex',
      gap: theme.spacing(1.5),
      alignItems: 'center',
      padding: theme.spacing(0.5, 1),
      minWidth: 0,
    }),
    logService: css({ fontWeight: theme.typography.fontWeightMedium, minWidth: 110 }),
    logText: css({
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      fontFamily: theme.typography.fontFamilyMonospace,
      fontSize: theme.typography.bodySmall.fontSize,
      minWidth: 0,
    }),
  };
};

export default OtelFirstTraceView;
