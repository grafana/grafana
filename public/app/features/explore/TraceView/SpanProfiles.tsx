import { createContext, type PropsWithChildren, useContext, useEffect, useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { type TraceToProfilesOptions } from '@grafana/o11y-ds-frontend';
import { getBackendSrv, getDataSourceInstanceList, getTemplateSrv } from '@grafana/runtime';
import { Button, Dropdown, Menu } from '@grafana/ui';

import { type TraceSpan } from './components/types/trace';
import { defaultProfilingKeys, scopedVarsFromSpan, scopedVarsFromTags } from './createSpanLink';
import { scopedVarsFromTrace } from './createTraceLink';
import { getFormattedTags, getSpanTags } from './crossSignalConfig';

export interface SpanProfileMatch {
  datasourceUid: string;
  labelSelector: string;
  profileTypeId: string;
  spanId: string;
  total?: string;
}

const TraceProfilesContext = createContext<{ spans: TraceSpan[]; onGoToSpan: (spanId: string) => void }>({
  spans: [],
  onGoToSpan: () => {},
});

export function TraceProfilesButton() {
  const profiles = useSpanProfiles();
  const status = useSpanProfilesStatus();
  const { spans, onGoToSpan } = useContext(TraceProfilesContext);
  const { reveal } = useContext(SpanProfileRevealContext);
  const ranked = Object.entries(profiles)
    .map(([spanId, matches]) => {
      // CPU nanoseconds and sample counts describe the same profile; never add them together.
      const cpu = matches.filter((match) => match.profileTypeId === 'process_cpu:cpu:nanoseconds:cpu:nanoseconds');
      const cpuNs = cpu.length ? Math.max(...cpu.map((match) => Number(match.total ?? 0))) : undefined;
      return { spanId, cpuNs, span: spans.find((span) => span.spanID === spanId) };
    })
    .sort((a, b) => (b.cpuNs ?? -1) - (a.cpuNs ?? -1) || (a.spanId < b.spanId ? -1 : a.spanId > b.spanId ? 1 : 0));
  if (status === 'disabled') {
    return null;
  }
  return (
    <Dropdown
      placement="bottom-end"
      overlay={
        <Menu>
          {ranked.map(({ spanId, span, cpuNs }) => (
            <Menu.Item
              key={spanId}
              label={t('explore.trace-profiles.span-label', '{{service}} — {{operation}} — {{cpu}} ({{spanId}})', {
                service: span?.process.serviceName ?? '',
                operation: span?.operationName ?? spanId,
                cpu:
                  cpuNs === undefined
                    ? t('explore.trace-profiles.cpu-unavailable', 'CPU time unavailable')
                    : t('explore.trace-profiles.cpu-time', '{{value}} ms CPU', { value: (cpuNs / 1e6).toFixed(3) }),
                spanId,
              })}
              onClick={() => {
                reveal(spanId);
                onGoToSpan(spanId);
              }}
            />
          ))}
        </Menu>
      }
    >
      <Button
        size="sm"
        fill="outline"
        icon={status === 'loading' ? 'spinner' : 'fire'}
        variant={ranked.length ? 'primary' : 'secondary'}
        disabled={!ranked.length}
        tooltip={
          status === 'loading'
            ? t('explore.trace-profiles.checking', 'Checking for profiles…')
            : ranked.length
              ? t('explore.trace-profiles.available', 'Show profiled spans ordered by CPU time')
              : status === 'done'
                ? t('explore.trace-profiles.absent', 'No profiles found for this trace')
                : t('explore.trace-profiles.unavailable', 'Profile availability could not be determined')
        }
      >
        <Trans i18nKey="explore.trace-profiles.button">Profiles for this trace</Trans>
      </Button>
    </Dropdown>
  );
}

export const SpanProfilesContext = createContext<Record<string, SpanProfileMatch[]>>({});
export const useSpanProfiles = () => useContext(SpanProfilesContext);
export const SpanProfileRevealContext = createContext({ spanId: '', reveal: (_spanId: string) => {} });
export const SpanProfilesStatusContext = createContext('disabled');
export const useSpanProfilesStatus = () => useContext(SpanProfilesStatusContext);

const scopeAliases = {
  container: ['k8s.container.name', 'container.name', 'container'],
  workload: [
    'k8s.workload.name',
    'workload',
    'k8s.deployment.name',
    'k8s.statefulset.name',
    'k8s.daemonset.name',
    'k8s.job.name',
    'k8s.cronjob.name',
  ],
  namespace: ['k8s.namespace.name', 'namespace'],
  cluster: ['k8s.cluster.name', 'cluster'],
};

export function profileScope(span: TraceSpan): Record<string, string> | undefined {
  const scope: Record<string, string> = {};
  for (const [key, aliases] of Object.entries(scopeAliases)) {
    const value = aliases
      .map((alias) => span.process.tags.find((tag) => tag.key === alias)?.value)
      .find((value) => typeof value === 'string' && value.length > 0);
    if (typeof value !== 'string') {
      return undefined;
    }
    scope[key] = value;
  }
  return scope;
}

export function fallbackProfileSelector(
  span: TraceSpan,
  options: TraceToProfilesOptions,
  traceDuration = 0,
  traceName = ''
): string {
  if (options.customQuery && options.query) {
    return getTemplateSrv().replace(options.query, {
      ...scopedVarsFromTrace(traceDuration, traceName, span.traceID),
      ...scopedVarsFromSpan(span),
      ...scopedVarsFromTags(span, options),
    });
  }
  return `{${getFormattedTags(getSpanTags(span), options.tags?.length ? options.tags : defaultProfilingKeys)}}`;
}

interface PresenceResponse {
  spans?: Array<{ traceId?: string; spanId: string; totals?: Array<{ profileTypeID: string; total: string }> }>;
}

export function SpanProfilesProvider({
  spans,
  traceId,
  options,
  onGoToSpan,
  traceDuration = 0,
  traceName = '',
  children,
}: PropsWithChildren<{
  spans: TraceSpan[];
  traceId: string;
  options?: TraceToProfilesOptions;
  onGoToSpan: (spanId: string) => void;
  traceDuration?: number;
  traceName?: string;
}>) {
  const [revealedSpanId, setRevealedSpanId] = useState('');
  const [result, setResult] = useState<{ matches: Record<string, SpanProfileMatch[]>; status: string }>({
    matches: {},
    status: 'loading',
  });
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const sources = await getDataSourceInstanceList({ type: 'grafana-pyroscope-datasource' });
      const source =
        sources.find((source) => source.uid === options?.datasourceUid) ??
        sources.find((source) => source.uid === 'grafanacloud-profiles') ??
        (sources.length === 1 ? sources[0] : undefined);
      if (!source || !spans.length) {
        return { matches: {}, status: 'unavailable' };
      }
      const start = Math.floor(Math.min(...spans.map((span) => span.startTime)) / 1000) - 60000;
      const end = Math.ceil(Math.max(...spans.map((span) => span.startTime + span.duration)) / 1000) + 60000;
      const groups = new Map<string, { scope?: Record<string, string>; spans: TraceSpan[] }>();
      for (const span of spans) {
        const scope = profileScope(span);
        const key = scope
          ? JSON.stringify(scope)
          : `fallback:${options ? fallbackProfileSelector(span, options, traceDuration, traceName) : span.processID}`;
        const group = groups.get(key) ?? { scope, spans: [] };
        group.spans.push(span);
        groups.set(key, group);
      }
      const matches: Record<string, SpanProfileMatch[]> = {};
      let failed = false;
      await Promise.all(
        Array.from(groups.values()).map(async (group) => {
          let selectors: string[] = [];
          if (group.scope) {
            try {
              const properties = Object.entries(group.scope)
                .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
                .join(', ');
              const response = await getBackendSrv().post<{ rows: unknown[][] }>(
                '/api/plugins/grafana-asserts-app/resources/asserts/api-server/v1/query/cypher',
                { query: `MATCH (p:ProfiledWorkload {${properties}}) RETURN p.service_name LIMIT 100`, start, end }
              );
              selectors = Array.from(
                new Set(response.rows.flatMap((row) => (typeof row[0] === 'string' ? [row[0]] : [])))
              ).map((service) => `{service_name=${JSON.stringify(service)}}`);
            } catch {
              // KG is optional; use the configured trace-to-profiles mapping below.
            }
          }
          if (!selectors.length && options?.datasourceUid) {
            selectors = [fallbackProfileSelector(group.spans[0], options, traceDuration, traceName)];
          }
          await Promise.all(
            selectors.map(async (labelSelector) => {
              try {
                const spanIds = group.spans.map((span) => span.spanID);
                const response = await getBackendSrv().post<PresenceResponse>(
                  `/api/datasources/proxy/uid/${encodeURIComponent(source.uid)}/querier.v1.QuerierService/SelectSpanPresence`,
                  { start: String(start), end: String(end), labelSelector, spanSelector: spanIds }
                );
                for (const span of response.spans ?? []) {
                  if (!spanIds.includes(span.spanId) || (span.traceId && span.traceId !== traceId)) {
                    continue;
                  }
                  for (const total of span.totals ?? []) {
                    (matches[span.spanId] ??= []).push({
                      datasourceUid: source.uid,
                      labelSelector,
                      profileTypeId: total.profileTypeID,
                      spanId: span.spanId,
                      total: total.total,
                    });
                  }
                }
              } catch {
                failed = true;
              }
            })
          );
        })
      );
      return { matches, status: failed ? 'error' : 'done' };
    }
    void load()
      .then((result) => {
        if (!cancelled) {
          setResult(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResult({ matches: {}, status: 'error' });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [spans, traceId, options, traceDuration, traceName]);

  return (
    <SpanProfilesContext.Provider value={result.matches}>
      <SpanProfilesStatusContext.Provider value={result.status}>
        <SpanProfileRevealContext.Provider value={{ spanId: revealedSpanId, reveal: setRevealedSpanId }}>
          <TraceProfilesContext.Provider value={{ spans, onGoToSpan }}>{children}</TraceProfilesContext.Provider>
        </SpanProfileRevealContext.Provider>
      </SpanProfilesStatusContext.Provider>
    </SpanProfilesContext.Provider>
  );
}
