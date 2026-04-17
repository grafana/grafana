import { type DataFrame } from '@grafana/data';
import { useQueryRunner } from '@grafana/scenes-react';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { FIELD_NAMES } from '../constants';

import { normalizeFrame } from './dataTransform';
import { uniqueAlertInstancesExpr } from './queries';
import { getDataQuery, useQueryFilter } from './utils';

export interface TriagePredefinedTimeRangeStat {
  label: string;
  duration: string;
  firing: number;
  pending: number;
}

const TRIAGE_PREDEFINED_TIME_RANGES = [
  { label: 'Last 4 hours', duration: '4h' },
  { label: 'Last 12 hours', duration: '12h' },
  { label: 'Last 24 hours', duration: '24h' },
  { label: 'Last 48 hours', duration: '48h' },
] as const;

function findFrame(series: DataFrame[], refId: string): DataFrame | undefined {
  // Prometheus plugin may rename value fields to "Value #<refId>" when multiple queries share a runner.
  return series.find((frame) => frame.refId === refId || frame.fields.some((f) => f.name === `${FIELD_NAMES.valuePrefix}${refId}`));
}

function parseAlertStateCounts(frame: DataFrame | undefined): { firing: number; pending: number } {
  if (!frame?.fields?.length) {
    return { firing: 0, pending: 0 };
  }

  const normalized = normalizeFrame(frame);
  const alertstateField = normalized.fields.find((f) => f.name === FIELD_NAMES.alertstate);
  const valueField = normalized.fields.find((f) => f.name === FIELD_NAMES.value);

  if (!alertstateField || !valueField) {
    return { firing: 0, pending: 0 };
  }

  const getValue = (state: PromAlertingRuleState) => {
    const index = alertstateField.values.findIndex((s: string) => s === state);
    return valueField.values[index] ?? 0;
  };

  return {
    firing: getValue(PromAlertingRuleState.Firing),
    pending: getValue(PromAlertingRuleState.Pending),
  };
}

export function useTriagePredefinedTimeRangeStats(): {
  windows: TriagePredefinedTimeRangeStat[];
  isLoading: boolean;
} {
  const filter = useQueryFilter();

  const queries = TRIAGE_PREDEFINED_TIME_RANGES.map((window) => {
    const refId = `W${window.duration}`;
    const expr = `count by (alertstate) (${uniqueAlertInstancesExpr(filter, window.duration)})`;
    return getDataQuery(expr, { refId, instant: true, range: false, format: 'table' });
  });

  const runner = useQueryRunner({ queries });
  const { data } = runner.useState();
  const series = data?.series ?? [];

  return {
    windows: TRIAGE_PREDEFINED_TIME_RANGES.map((window) => {
      const refId = `W${window.duration}`;
      const frame = findFrame(series, refId);
      const counts = parseAlertStateCounts(frame);
      return { ...window, ...counts };
    }),
    isLoading: !runner.isDataReadyToDisplay(),
  };
}
