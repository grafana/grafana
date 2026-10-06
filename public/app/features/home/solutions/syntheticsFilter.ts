import type * as z from 'zod';

import { t } from '@grafana/i18n';

import {
  DatasourceBoundFilterSchema,
  fetchFilterLabelValues,
  parseStoredFilter,
  TrimmedValues,
} from './solutionFilter';
import { hasIgnores } from './syntheticsData';

const SyntheticsFilterSchema = DatasourceBoundFilterSchema.extend({
  jobs: TrimmedValues,
  instances: TrimmedValues,
  probes: TrimmedValues,
});

export type SyntheticsFilter = z.infer<typeof SyntheticsFilterSchema>;

/** Stored JSON → filter. Null for a missing/malformed value or an empty selection: both mean every check counts. */
export function parseSyntheticsFilter(raw: string | undefined): SyntheticsFilter | null {
  return parseStoredFilter(raw, SyntheticsFilterSchema, (filter) => !hasIgnores(filter));
}

/** Human summary for tooltips: non-empty parts joined with ' · '. */
export function summarizeSyntheticsFilter(filter: SyntheticsFilter): string {
  const parts: string[] = [];
  if (filter.jobs.length > 0) {
    parts.push(
      t('home.solutions.synthetics.filter.summary-jobs', 'Ignoring checks: {{jobs}}', {
        jobs: filter.jobs.join(', '),
        interpolation: { escapeValue: false },
      })
    );
  }
  if (filter.instances.length > 0) {
    parts.push(
      t('home.solutions.synthetics.filter.summary-instances', 'Ignoring targets: {{instances}}', {
        instances: filter.instances.join(', '),
        interpolation: { escapeValue: false },
      })
    );
  }
  if (filter.probes.length > 0) {
    parts.push(
      t('home.solutions.synthetics.filter.summary-probes', 'Ignoring probes: {{probes}}', {
        probes: filter.probes.join(', '),
        interpolation: { escapeValue: false },
      })
    );
  }
  return parts.join(' · ');
}

export type SyntheticsIgnoreLabel = 'job' | 'instance' | 'probe';

/** Distinct values of `key` on sm_check_info over the last 24h; the lists are independent of each other. */
export function fetchSyntheticsLabelValues(uid: string, key: SyntheticsIgnoreLabel): Promise<string[]> {
  return fetchFilterLabelValues(uid, key, 'sm_check_info');
}
