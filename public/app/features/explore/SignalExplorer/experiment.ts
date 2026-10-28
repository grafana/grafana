import {
  type EvaluationDetails,
  ProviderStatus,
  useBooleanFlagDetails,
  useOpenFeatureClientStatus,
} from '@openfeature/react-sdk';
import { useEffect } from 'react';

import { reportExperimentView, reportInteraction } from '@grafana/runtime';
import { FlagKeys } from '@grafana/runtime/internal';

const EXPERIMENT_ID = 'signal_explorer';
// The eligible population: an Explore pane with the outline shown and Prometheus selected.
const EXPERIMENT_GROUP = 'explore_prometheus';

export type SignalExplorerVariant = 'treatment' | 'control';

let currentVariant: SignalExplorerVariant | undefined;
// Keyed by pane id, which Explore regenerates per pane, so outline toggles and remounts within a
// pane do not re-expose it while a new pane or a fresh visit does.
const exposedPanes = new Set<string>();

/**
 * Only a successful evaluation of a recognised variant counts. The flag's `excluded` variant is
 * also `false`, so reading the value alone would file non-randomised stacks into control.
 */
export function resolveSignalExplorerVariant(
  flag: Pick<EvaluationDetails<boolean>, 'value' | 'variant' | 'errorCode'>
): SignalExplorerVariant | undefined {
  if (flag.errorCode !== undefined) {
    return undefined;
  }
  if (flag.variant === 'enabled' && flag.value) {
    return 'treatment';
  }
  if (flag.variant === 'disabled' && !flag.value) {
    return 'control';
  }
  return undefined;
}

/** Returns whether the sidebar is enabled, and records the pane's arm once it is eligible. */
export function useSignalExplorerFlag(exploreId: string, eligible: boolean): boolean {
  const { value, variant, errorCode } = useBooleanFlagDetails(FlagKeys.GrafanaExploreMetricsSidebar, false, {
    suspendUntilReady: false,
    suspendWhileReconciling: false,
  });
  // READY says the provider answered, not that this flag did; `errorCode` covers the flag itself.
  const providerStatus = useOpenFeatureClientStatus();

  useEffect(() => {
    if (!eligible || providerStatus !== ProviderStatus.READY) {
      return;
    }
    const arm = resolveSignalExplorerVariant({ value, variant, errorCode });
    if (!arm) {
      return;
    }
    currentVariant = arm;
    if (exposedPanes.has(exploreId)) {
      return;
    }
    exposedPanes.add(exploreId);
    reportExperimentView(EXPERIMENT_ID, EXPERIMENT_GROUP, arm);
  }, [exploreId, eligible, providerStatus, value, variant, errorCode]);

  return value;
}

/** The arm to stamp on an outcome event from this pane, or `{}` when the pane was never exposed. */
export function getSignalExplorerExperimentPayload(exploreId: string): {
  experiment_signal_explorer?: SignalExplorerVariant;
} {
  if (!currentVariant || !exposedPanes.has(exploreId)) {
    return {};
  }
  return { experiment_signal_explorer: currentVariant };
}

/**
 * The experiment's outcome event, in both arms. Sent only from exposed panes, so Explore traffic
 * outside the experiment adds no rows.
 */
export function trackSignalExplorerExperimentQueriesRun(
  exploreId: string,
  props: { data_source_type: string; queries_count: number }
) {
  const payload = getSignalExplorerExperimentPayload(exploreId);
  if (!payload.experiment_signal_explorer) {
    return;
  }
  reportInteraction('grafana_explore_queries_run', { ...props, ...payload });
}
