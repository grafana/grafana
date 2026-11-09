import { useEffect, useMemo, useRef, useState } from 'react';

import { logError } from '@grafana/runtime';
import { type Dashboard } from '@grafana/schema';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { isDashboardV2Spec } from 'app/features/dashboard/api/utils';
import { importPanelPlugin, syncGetPanelPlugin } from 'app/features/plugins/importPanelPlugin';

import { getScenePendingChangePreview } from '../../../lifecycle/pendingChangePreview';
import { type DashboardScene } from '../../../scene/DashboardScene';
import { summarizeDashboardChanges } from '../summarizeDashboardChanges';
import { type ReviewInput, type ReviewMode, type ReviewSummary } from '../types';

/** Plugin labels are a nicety: past this, the summary falls back to humanized keys rather than wait. */
const PLUGIN_PRELOAD_TIMEOUT_MS = 1000;

export type ReviewSummaryState =
  | { status: 'loading' }
  | { status: 'error' }
  /** refreshing: the summary is being recomputed; until then this is the previous one, kept so the open parts stay open. */
  | { status: 'ready'; summary: ReviewSummary; refreshing?: boolean };

export interface UseReviewSummaryOptions {
  dashboard: DashboardScene;
  mode: ReviewMode;
  /** The drawer's change info models (useDashboardSaveChanges), already masked by the save options. */
  initialSaveModel: Dashboard | DashboardV2Spec;
  changedSaveModel: Dashboard | DashboardV2Spec;
  /** The Save As form's parked values (the drawer's saveFormDraft); read for 'new' and 'saveAsCopy'. */
  draft?: { title?: string; description?: string; copyTags?: boolean };
  metadata?: ReviewInput['metadata'];
}

/**
 * Summarizes the save for the Review tab. Mount it only while Review is open: it computes on mount and
 * again when the drawer's change info, the metadata or a Save As value changes, never on every render.
 */
export function useReviewSummary({
  dashboard,
  mode,
  initialSaveModel,
  changedSaveModel,
  draft,
  metadata,
}: UseReviewSummaryOptions): ReviewSummaryState {
  // Plugins that failed to load or missed the timeout: waiting for them again would hold up every refresh.
  const unloadable = useRef(new Set<string>());

  const { title, description, copyTags } = draft ?? {};
  // Results are tagged with the inputs they were computed for, so a stale result reads as loading.
  const inputs = useMemo(
    (): UseReviewSummaryOptions => ({
      dashboard,
      mode,
      initialSaveModel,
      changedSaveModel,
      draft: { title, description, copyTags },
      metadata,
    }),
    [dashboard, mode, initialSaveModel, changedSaveModel, title, description, copyTags, metadata]
  );
  const [result, setResult] = useState<{ inputs: typeof inputs; state: ReviewSummaryState }>();

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      // Yield a macrotask so the loading state paints before the synchronous work below.
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (cancelled) {
        return;
      }

      const input = buildReviewInput(inputs);
      await preloadPanelPlugins([input.baseline, input.payload], unloadable.current);
      if (cancelled) {
        return;
      }

      const summary = summarizeDashboardChanges({ ...input, getPlugin: syncGetPanelPlugin });
      if (!cancelled) {
        setResult({ inputs, state: { status: 'ready', summary } });
      }
    };

    run().catch((error: unknown) => {
      logError(error instanceof Error ? error : new Error(String(error)), { source: 'dashboard-review-summary' });
      if (!cancelled) {
        setResult({ inputs, state: { status: 'error' } });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [inputs]);

  if (result?.inputs === inputs) {
    return result.state;
  }
  return result?.state.status === 'ready' ? { ...result.state, refreshing: true } : { status: 'loading' };
}

function buildReviewInput({
  dashboard,
  mode,
  initialSaveModel,
  changedSaveModel,
  draft,
  metadata,
}: UseReviewSummaryOptions): ReviewInput {
  if (!isDashboardV2Spec(initialSaveModel) || !isDashboardV2Spec(changedSaveModel)) {
    throw new Error('Review supports v2 dashboards only');
  }

  const baselineKind = getScenePendingChangePreview(dashboard.state)?.previewing ? 'pendingChanges' : 'saved';
  const common = { baselineKind, ...(metadata ? { metadata } : {}) } as const;

  if (mode === 'save') {
    return { ...common, mode, baseline: initialSaveModel, payload: changedSaveModel };
  }

  // Save As serializes the scene again rather than reuse changedSaveModel: the save options' masking rewrote that
  // model's time settings and variable values in place, and Save As sends them unmasked.
  if (mode === 'new') {
    const payload = dashboard.getSaveAsModel({
      isNew: true,
      title: draft?.title ?? changedSaveModel.title,
      description: draft?.description ?? changedSaveModel.description,
      copyTags: true,
    });
    return { ...common, mode, baseline: null, payload: asV2Spec(payload) };
  }

  // The fallbacks mirror the Save As form's defaults, for a draft not parked yet.
  const payload = dashboard.getSaveAsModel({
    isNew: false,
    title: draft?.title ?? `${changedSaveModel.title} Copy`,
    description: draft?.description ?? changedSaveModel.description,
    copyTags: draft?.copyTags ?? false,
  });
  return {
    ...common,
    mode,
    baseline: initialSaveModel,
    payload: asV2Spec(payload),
    sourceTitle: initialSaveModel.title,
  };
}

function asV2Spec(model: unknown): DashboardV2Spec {
  if (!isDashboardV2Spec(model)) {
    throw new Error('Review supports v2 dashboards only');
  }
  return model;
}

async function preloadPanelPlugins(specs: Array<DashboardV2Spec | null>, unloadable: Set<string>) {
  const ids = new Set<string>();
  for (const spec of specs) {
    for (const element of Object.values(spec?.elements ?? {})) {
      if (element.kind === 'Panel' && element.spec.vizConfig.group) {
        ids.add(element.spec.vizConfig.group);
      }
    }
  }

  const missing = [...ids].filter((id) => !unloadable.has(id) && !syncGetPanelPlugin(id));
  if (missing.length === 0) {
    return;
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, PLUGIN_PRELOAD_TIMEOUT_MS);
  });
  const pending = new Set(missing);
  const loads = missing.map((id) => importPanelPlugin(id).then(() => pending.delete(id)));
  // allSettled: a plugin that fails to load only costs its labels.
  await Promise.race([Promise.allSettled(loads), timeout]);
  clearTimeout(timer);
  pending.forEach((id) => unloadable.add(id));
}
