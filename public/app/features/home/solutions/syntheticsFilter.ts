import type * as z from 'zod';

import { t } from '@grafana/i18n';

import { fetchLabelValues } from './promQuery';
import { DatasourceBoundFilterSchema, parseStoredFilter, TrimmedValues } from './solutionFilter';
import { hasIgnores, type IgnoreLabel } from './syntheticsData';

const SyntheticsFilterSchema = DatasourceBoundFilterSchema.extend({
  job: TrimmedValues,
  instance: TrimmedValues,
  probe: TrimmedValues,
});

export type SyntheticsFilter = z.infer<typeof SyntheticsFilterSchema>;

/** Stored JSON → filter. Null for a missing/malformed value or an empty selection: both mean every check counts. */
export function parseSyntheticsFilter(raw: string | undefined): SyntheticsFilter | null {
  return parseStoredFilter(raw, SyntheticsFilterSchema, (filter) => !hasIgnores(filter));
}

/** Human summary for tooltips: non-empty parts joined with ' · '. */
export function summarizeSyntheticsFilter(filter: SyntheticsFilter): string {
  const parts: string[] = [];
  if (filter.job.length > 0) {
    parts.push(
      t('home.solutions.synthetics.filter.summary-jobs', 'Ignoring checks: {{jobs}}', {
        jobs: filter.job.join(', '),
        interpolation: { escapeValue: false },
      })
    );
  }
  if (filter.instance.length > 0) {
    parts.push(
      t('home.solutions.synthetics.filter.summary-instances', 'Ignoring targets: {{instances}}', {
        instances: filter.instance.join(', '),
        interpolation: { escapeValue: false },
      })
    );
  }
  if (filter.probe.length > 0) {
    parts.push(
      t('home.solutions.synthetics.filter.summary-probes', 'Ignoring probes: {{probes}}', {
        probes: filter.probe.join(', '),
        interpolation: { escapeValue: false },
      })
    );
  }
  return parts.join(' · ');
}

/** Distinct values of `label` on sm_check_info over the last 24h; the lists are independent of each other. */
export function fetchSyntheticsLabelValues(uid: string, label: IgnoreLabel): Promise<string[]> {
  return fetchLabelValues(uid, label, 'sm_check_info');
}
