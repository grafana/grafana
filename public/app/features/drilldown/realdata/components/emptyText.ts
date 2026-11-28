import { t } from '@grafana/i18n';

import { type ChartKind, type ChartState, type EmptyReason } from '../serviceCharts';

interface Subject {
  service: string;
  environment?: string;
}

// A service name or a value from a data source can hold a slash or a quote. React escapes text when it draws it, so
// i18next leaves the values as they are.
const RAW = { interpolation: { escapeValue: false } };

// What an empty panel says about the service. A lookup after the panel's query limits what it can claim. Without one,
// the sentence states what the panel's own query returned.
export function emptyText(chart: ChartKind, state: ChartState | undefined, { service, environment }: Subject): string {
  const empty = state?.kind === 'empty' ? state : undefined;
  const value = empty?.value ?? service;

  switch (chart) {
    case 'traces':
      return tracesText(empty?.reason, service, environment);
    case 'metrics':
      return metricsText(empty?.reason, service, environment);
    case 'logs':
      return logsText(empty?.reason, service, value, environment);
    case 'profiles':
      return profilesText(empty?.reason, service, value, environment);
  }
}

function tracesText(reason: EmptyReason | undefined, service: string, environment: string | undefined) {
  switch (reason?.type) {
    case 'no-spans':
      return t('drilldown-real.services.traces-no-spans', 'No spans for {{service}} in the last 30 minutes', {
        service,
        ...RAW,
      });
    case 'no-server-spans':
      return t(
        'drilldown-real.services.traces-no-server-spans',
        'No server or consumer spans for {{service}} in the last 30 minutes. Span kinds found: {{kinds}}',
        { service, kinds: reason.kinds.join(', '), ...RAW }
      );
    default:
      return environment
        ? t(
            'drilldown-real.services.traces-empty-in-environment',
            'No server or consumer spans for {{service}} in {{environment}} in the last 30 minutes',
            { service, environment, ...RAW }
          )
        : t(
            'drilldown-real.services.traces-empty',
            'No server or consumer spans for {{service}} in the last 30 minutes',
            { service, ...RAW }
          );
  }
}

function metricsText(reason: EmptyReason | undefined, service: string, environment: string | undefined) {
  switch (reason?.type) {
    case 'no-series': {
      const label = reason.label;
      const sentences = [
        t(
          'drilldown-real.services.no-series',
          'No series with {{label}}="{{service}}" in {{metric}} in the last 30 minutes',
          { label, service, metric: reason.metric, ...RAW }
        ),
        reason.otherMetrics
          ? t('drilldown-real.services.no-series-other', 'Other metrics have {{label}}="{{service}}"', {
              label,
              service,
              ...RAW,
            })
          : undefined,
        reason.inJob ? t('drilldown-real.services.no-series-job', 'It might exist under job') : undefined,
      ].filter((sentence) => sentence !== undefined);
      return sentences.length > 1 ? `${sentences.join('. ')}.` : sentences[0];
    }
    case 'filtered':
      return environment
        ? t(
            'drilldown-real.services.span-metrics-filtered-in-environment',
            '{{service}} has span metrics, but none for server or consumer spans in {{environment}}',
            { service, environment, ...RAW }
          )
        : t(
            'drilldown-real.services.span-metrics-filtered',
            '{{service}} has span metrics, but none for server or consumer spans',
            { service, ...RAW }
          );
    default:
      return t('drilldown-real.services.metrics-empty', 'No p95 latency for {{service}} in the last 30 minutes', {
        service,
        ...RAW,
      });
  }
}

function logsText(reason: EmptyReason | undefined, service: string, value: string, environment: string | undefined) {
  switch (reason?.type) {
    case 'no-value':
      return t(
        'drilldown-real.services.logs-no-value',
        'No Loki service_name equals {{service}} or ends with /{{service}} in the last 30 minutes',
        { service, ...RAW }
      );
    case 'no-lines':
      return t(
        'drilldown-real.services.logs-no-lines',
        'No log lines with service_name="{{value}}" in the last 30 minutes',
        { value, ...RAW }
      );
    case 'filtered':
      return t(
        'drilldown-real.services.logs-filtered',
        'Log lines exist for {{value}}, but none with deployment_environment_name="{{environment}}"',
        { value, environment: environment ?? '', ...RAW }
      );
    default:
      return t('drilldown-real.services.logs-empty', 'No error lines found for {{value}} in the last 30 minutes', {
        value,
        ...RAW,
      });
  }
}

function profilesText(
  reason: EmptyReason | undefined,
  service: string,
  value: string,
  environment: string | undefined
) {
  switch (reason?.type) {
    case 'no-value':
      return t(
        'drilldown-real.services.profiles-no-value',
        'No Pyroscope service_name equals {{service}} or ends with /{{service}} in the last 30 minutes',
        { service, ...RAW }
      );
    case 'outside-environment':
      return t(
        'drilldown-real.services.profiles-outside-environment',
        'CPU profiles exist for {{value}}, but none with cluster="{{environment}}"',
        { value, environment: environment ?? '', ...RAW }
      );
    default:
      return t(
        'drilldown-real.services.profiles-empty',
        'No CPU profiles with service_name="{{value}}" in the last 30 minutes',
        { value, ...RAW }
      );
  }
}
