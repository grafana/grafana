import { t } from '@grafana/i18n';

import { TRACES_UID, datasourceJson, lokiLabelValues, lokiLogs, promInstant, tempoTagValues } from '../realdata/labApi';

const CALLS = 'traces_span_metrics_calls_total';
const WINDOW_S = 3600;

export type CheckStatus = 'pass' | 'fail' | 'check' | 'not-run' | 'info';
export type CheckFix = 'namespace' | 'mapping';

export interface Check {
  id: string;
  status: CheckStatus;
  title: string;
  detail: string;
  // The ticket theme the check comes from, as named in the readiness artifact.
  theme: string;
  fix?: CheckFix;
}

export interface ReadinessService {
  name: string;
  inMetrics: boolean;
  inLogs: boolean;
  inTraces: boolean;
  hasNamespace: boolean;
  gap: boolean;
}

export interface ServiceList {
  services: ReadinessService[];
  // The namespace most services report, offered as the value when a service has none.
  commonNamespace: string;
  // False when Loki holds no values for deployment_environment_name, so logs cannot be filtered by environment.
  logsHaveEnvironment: boolean;
}

const nowSec = () => Math.floor(Date.now() / 1000);
const esc = (value: string) => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
export const isUnnamed = (name: string) => name.startsWith('unknown_service');

// Every name any of the three signals reports, with the signals each name appears in.
export async function loadServiceList(): Promise<ServiceList> {
  const end = nowSec();
  const start = end - WINDOW_S;
  const [metricRows, namespaceRows, logNames, traceNames, namespaces, environments] = await Promise.all([
    promInstant(`count by (service_name) (rate(${CALLS}[5m]))`, end),
    promInstant(`count by (service_name) (${CALLS}{service_namespace!=""})`, end),
    lokiLabelValues('service_name', start, end).catch(() => []),
    tempoTagValues('resource.service.name', start, end).catch(() => []),
    promInstant(`count by (service_namespace) (${CALLS}{service_namespace!=""})`, end),
    lokiLabelValues('deployment_environment_name', start, end).catch(() => []),
  ]);

  const inMetrics = new Set(metricRows.map((row) => row.metric.service_name));
  const withNamespace = new Set(namespaceRows.map((row) => row.metric.service_name));
  const inLogs = new Set(logNames ?? []);
  const inTraces = new Set(traceNames ?? []);

  const services = [...new Set([...inMetrics, ...inLogs, ...inTraces])].map((name): ReadinessService => {
    const row = {
      name,
      inMetrics: inMetrics.has(name),
      inLogs: inLogs.has(name),
      inTraces: inTraces.has(name),
      hasNamespace: withNamespace.has(name),
    };
    return { ...row, gap: !(row.inMetrics && row.inLogs && row.inTraces && row.hasNamespace) || isUnnamed(name) };
  });
  // Services with a gap come first, then the rest by name.
  services.sort((a, b) => Number(b.gap) - Number(a.gap) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

  const top = [...namespaces].sort((a, b) => b.value - a.value)[0];
  return {
    services,
    commonNamespace: top?.metric.service_namespace ?? '',
    logsHaveEnvironment: (environments ?? []).length > 0,
  };
}

// The checks support runs by hand for one service, each with the evidence it read.
export async function runChecks(service: ReadinessService): Promise<Check[]> {
  const end = nowSec();
  const start = end - WINDOW_S;
  const name = esc(service.name);
  const labelCount = (label: string) =>
    promInstant(`count(${CALLS}{service_name="${name}", ${label}!=""})`, end)
      .then((rows) => rows.length > 0)
      .catch(() => false);

  const [hasVersion, hasSpanName, hasStatus, traceLine, mapping] = await Promise.all([
    labelCount('service_version'),
    labelCount('span_name'),
    labelCount('status_code'),
    lokiLogs(`{service_name="${name}"} |~ "(?i)trace_?id"`, start, end, 1).catch(() => undefined),
    datasourceJson(TRACES_UID)
      .then(async (tempo) => {
        const uid = tempo.jsonData?.tracesToLogsV2?.datasourceUid ?? tempo.jsonData?.tracesToLogs?.datasourceUid;
        if (!uid) {
          return { kind: 'missing' as const };
        }
        const target = await datasourceJson(uid)
          .then(() => true)
          .catch(() => false);
        return { kind: target ? ('ok' as const) : ('broken' as const), uid };
      })
      .catch(() => undefined),
  ]);

  const listed = [
    service.inMetrics ? 'Metrics' : undefined,
    service.inLogs ? 'Logs' : undefined,
    service.inTraces ? 'Traces' : undefined,
  ].filter(Boolean);
  const missing = ['Metrics', 'Logs', 'Traces'].filter((signal) => !listed.includes(signal));
  const missingAttributes = [
    hasVersion ? undefined : 'service_version',
    hasSpanName ? undefined : 'span_name',
    hasStatus ? undefined : 'status_code',
  ].filter(Boolean);

  const checks: Check[] = [
    {
      id: 'service-name',
      status: isUnnamed(service.name) ? 'fail' : service.inMetrics ? 'pass' : 'check',
      title: t('drilldown-readiness.check.service-name', 'service.name is set'),
      detail: isUnnamed(service.name)
        ? 'The name starts with unknown_service. The SDK default replaced service.name.'
        : service.inMetrics
          ? `Seen in span metrics as service_name="${service.name}".`
          : 'No span metrics series carry this name.',
      theme: 'T1',
    },
    {
      id: 'namespace',
      status: service.hasNamespace ? 'pass' : 'fail',
      title: t('drilldown-readiness.check.namespace', 'service.namespace is present'),
      detail: service.hasNamespace
        ? 'Present on the span metrics series for this service.'
        : 'Missing on every span metrics series for this service. Same-named services in other namespaces cannot be told apart.',
      theme: 'T3',
      fix: service.hasNamespace ? undefined : 'namespace',
    },
    {
      id: 'name-match',
      status: missing.length === 0 ? 'pass' : 'check',
      title: t('drilldown-readiness.check.name-match', 'The name matches across signals'),
      detail:
        missing.length === 0
          ? 'Metrics, Logs and Traces all list this name.'
          : `${listed.join(' and ') || 'No signal'} list${listed.length === 1 ? 's' : ''} ${service.name}. ${missing.join(' and ')} list no entry with that name.`,
      theme: 'T3',
      fix: missing.length === 0 ? undefined : 'mapping',
    },
    {
      id: 'metric-labels',
      status: missingAttributes.length === 0 ? 'pass' : 'fail',
      title: t('drilldown-readiness.check.metric-labels', 'Attributes reach metrics as labels'),
      detail:
        missingAttributes.length === 0
          ? 'Span metrics carry service_version, span_name and status_code.'
          : `Span metrics for this service have no ${missingAttributes.join(', ')}.`,
      theme: 'T2',
    },
    {
      id: 'trace-id',
      status: traceLine && traceLine.length > 0 ? 'pass' : 'not-run',
      title: t('drilldown-readiness.check.trace-id', 'Trace ID field matches the log field'),
      detail:
        traceLine && traceLine.length > 0
          ? 'A log line for this service carries a trace ID field.'
          : 'Needs a log line with a trace ID. None found for this service in the last hour.',
      theme: 'T4',
    },
    {
      id: 'trace-to-logs',
      status: !mapping ? 'not-run' : mapping.kind === 'ok' ? 'pass' : 'fail',
      title: t('drilldown-readiness.check.trace-to-logs', 'Trace to log datasource mapping resolves'),
      detail: !mapping
        ? 'The Tempo data source settings could not be read.'
        : mapping.kind === 'ok'
          ? `The Tempo data source points at the existing data source ${mapping.uid}.`
          : mapping.kind === 'missing'
            ? 'The Tempo data source has no trace to logs mapping.'
            : `The mapping points at ${mapping.uid}, which does not exist.`,
      theme: 'T4',
    },
    {
      id: 'sampling',
      status: 'info',
      title: t('drilldown-readiness.check.sampling', 'Sampling can hide traces'),
      detail: 'If tail sampling is on, logs can reference traces that were dropped.',
      theme: 'T4',
    },
  ];
  return checks;
}
