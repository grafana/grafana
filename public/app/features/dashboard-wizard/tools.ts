import { lastValueFrom } from 'rxjs';

import { createTool, type InlineToolRunnable } from '@grafana/assistant';
import { getBackendSrv } from '@grafana/runtime';

import { type WizardDatasource, type WizardFinding } from './types';

const MAX_VALUES = 500;

// Prometheus/Loki label name syntax; also guards the URL we build below.
const LABEL_NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

interface LabelValuesInput {
  datasourceUid: string;
  label: string;
  contains?: string;
}

interface LabelValuesResponse {
  status: string;
  data?: string[];
}

function labelValuesUrl(ds: WizardDatasource, label: string): string | null {
  if (ds.type.includes('prometheus')) {
    return `/api/datasources/uid/${encodeURIComponent(ds.uid)}/resources/api/v1/label/${label}/values`;
  }
  if (ds.type === 'loki') {
    return `/api/datasources/uid/${encodeURIComponent(ds.uid)}/resources/loki/api/v1/label/${label}/values`;
  }
  return null;
}

/** Whether {@link lookupLabelValues} can query this datasource at all. */
export function supportsLabelLookups(ds: WizardDatasource): boolean {
  return labelValuesUrl(ds, 'job') !== null;
}

/**
 * Fetches the full set of metric names (`__name__` values) for a
 * Prometheus-compatible datasource, so a plan's metrics can be checked for
 * existence. Returns null for datasource types without a metric-name concept
 * (e.g. Loki) or when the lookup fails — callers treat null as "cannot verify".
 */
export async function fetchMetricNames(ds: WizardDatasource): Promise<Set<string> | null> {
  if (!ds.type.includes('prometheus')) {
    return null;
  }
  const url = `/api/datasources/uid/${encodeURIComponent(ds.uid)}/resources/api/v1/label/__name__/values`;
  try {
    const response = await lastValueFrom(
      getBackendSrv().fetch<LabelValuesResponse>({ url, method: 'GET', showErrorAlert: false })
    );
    return new Set(response.data?.data ?? []);
  } catch {
    return null;
  }
}

/**
 * Fetches the label names that actually appear on a specific metric (via the
 * Prometheus `labels?match[]=` API), excluding `__name__`. Returns null when
 * the datasource has no metric concept or the lookup fails — callers treat
 * null as "cannot verify" and must not assume any labels. Used to stop the
 * builder from filtering a metric by labels (e.g. cluster/namespace) it does
 * not carry, even when those labels exist elsewhere in the datasource.
 */
export async function fetchMetricLabels(ds: WizardDatasource, metric: string): Promise<string[] | null> {
  if (!ds.type.includes('prometheus') || metric.trim() === '') {
    return null;
  }
  const url = `/api/datasources/uid/${encodeURIComponent(ds.uid)}/resources/api/v1/labels?match%5B%5D=${encodeURIComponent(
    metric
  )}`;
  try {
    const response = await lastValueFrom(
      getBackendSrv().fetch<LabelValuesResponse>({ url, method: 'GET', showErrorAlert: false })
    );
    return (response.data?.data ?? []).filter((label) => label !== '__name__');
  } catch {
    return null;
  }
}

/**
 * Looks up the values of a label directly against the datasource's label API.
 * Returns null when the datasource type is unsupported or the label name is
 * invalid. Used by the wizard's assistant tool and by speculative prefetches.
 */
export async function lookupLabelValues(
  ds: WizardDatasource,
  label: string,
  contains?: string
): Promise<WizardFinding | null> {
  if (!LABEL_NAME_RE.test(label)) {
    return null;
  }
  const url = labelValuesUrl(ds, label);
  if (!url) {
    return null;
  }

  const response = await lastValueFrom(
    getBackendSrv().fetch<LabelValuesResponse>({ url, method: 'GET', showErrorAlert: false })
  );

  let values = response.data?.data ?? [];
  if (contains) {
    const needle = contains.toLowerCase();
    values = values.filter((value) => value.toLowerCase().includes(needle));
  }

  const truncated = values.length > MAX_VALUES;
  if (truncated) {
    values = values.slice(0, MAX_VALUES);
  }

  return {
    datasourceUid: ds.uid,
    datasourceName: ds.name ?? ds.uid,
    datasourceType: ds.type,
    label,
    contains,
    values,
    truncated,
  };
}

/**
 * Tools the wizard's inline assistant calls to ground its suggestions in data
 * that actually exists in this Grafana instance. Datasource access is
 * restricted to the datasources the wizard was opened with.
 *
 * Every successful lookup is reported through `onFinding` so the wizard can
 * replay what it learned to the dashboard-building agent later.
 */
export function buildWizardTools(
  datasources: WizardDatasource[],
  onFinding?: (finding: WizardFinding) => void
): InlineToolRunnable[] {
  const byUid = new Map(datasources.map((ds) => [ds.uid, ds]));

  const listLabelValues = createTool<LabelValuesInput>(
    async (input) => {
      const ds = byUid.get(input.datasourceUid);
      if (!ds) {
        return `Unknown datasource uid "${input.datasourceUid}". Use one of the datasources listed in the request.`;
      }

      const finding = await lookupLabelValues(ds, input.label, input.contains);
      if (!finding) {
        return `Datasource "${ds.name ?? ds.uid}" has type "${ds.type}", which this tool does not support. It only supports Prometheus-compatible and Loki datasources.`;
      }

      onFinding?.(finding);

      return JSON.stringify({
        datasource: ds.name ?? ds.uid,
        label: finding.label,
        count: finding.values.length,
        truncated: finding.truncated,
        values: finding.values,
      });
    },
    {
      /* eslint-disable @grafana/i18n/no-untranslated-strings -- LLM-facing tool schema, never rendered in the UI */
      name: 'list_label_values',
      description:
        'List the values of a label in a Prometheus-compatible or Loki datasource. Use label "__name__" on ' +
        'Prometheus datasources to list metric names (combine with "contains" to search). Use labels like "job", ' +
        '"namespace", or "cluster" to discover what services and infrastructure exist.',
      inputSchema: {
        type: 'object',
        properties: {
          datasourceUid: { type: 'string', description: 'UID of the datasource to query.' },
          label: { type: 'string', description: 'Label name, e.g. "__name__", "job", "namespace".' },
          contains: {
            type: 'string',
            description: 'Optional case-insensitive substring filter applied to the values.',
          },
        },
        required: ['datasourceUid', 'label'],
      },
      /* eslint-enable @grafana/i18n/no-untranslated-strings */
      validate: (input) => {
        const datasourceUid = typeof input.datasourceUid === 'string' ? input.datasourceUid : '';
        const label = typeof input.label === 'string' ? input.label : '';
        if (datasourceUid === '' || !LABEL_NAME_RE.test(label)) {
          throw new Error('list_label_values requires a datasourceUid and a valid label name.');
        }
        return {
          datasourceUid,
          label,
          contains: typeof input.contains === 'string' && input.contains !== '' ? input.contains : undefined,
        };
      },
      metadata: {
        explainer: (input?: LabelValuesInput) =>
          input ? `Checking values of "${input.label}"` : 'Checking available data',
      },
    }
  );

  return [listLabelValues];
}
