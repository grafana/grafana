import { debounce } from 'lodash';
import { useEffect, useRef, useState } from 'react';

import { logError } from '@grafana/runtime';
import { SceneObjectStateChangedEvent } from '@grafana/scenes';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { isDashboardV2Spec } from 'app/features/dashboard/api/utils';
import { importPanelPlugin, syncGetPanelPlugin } from 'app/features/plugins/importPanelPlugin';

import { getScenePendingChangePreview } from '../../../lifecycle/pendingChangePreview';
import { type DashboardScene } from '../../../scene/DashboardScene';
import { DashboardStateChangedEvent } from '../../../sidebar/events';
import { DashboardSceneChangeTracker } from '../../DashboardSceneChangeTracker';
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
  /** The Save As form's parked values (the drawer's saveFormDraft); read for 'new' and 'saveAsCopy'. */
  draft?: { title?: string; description?: string; copyTags?: boolean };
  metadata?: ReviewInput['metadata'];
  saveTimeRange?: boolean;
  saveVariables?: boolean;
  saveRefresh?: boolean;
}

/**
 * Summarizes the save for the Review tab. Mount it only while Review is open: it computes on mount and
 * again when the dashboard, a save option or a Save As value changes, never on every render.
 */
export function useReviewSummary(options: UseReviewSummaryOptions): ReviewSummaryState {
  // Results are tagged with the inputs they were computed for, so a stale result reads as loading.
  const [result, setResult] = useState<{ key: string; state: ReviewSummaryState }>();

  // The options are rebuilt on every drawer render, so they are read from here rather than keyed on:
  // keying on their identity would recompute forever.
  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  });

  const { dashboard, mode, draft, metadata, saveTimeRange, saveVariables, saveRefresh } = options;

  // The same signal that keeps the Changes tab current: an edit while Review is open (by the Assistant,
  // say) can leave the diff count unchanged, so the count alone can't tell that the summary is stale.
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const invalidate = debounce(() => setRevision((current) => current + 1), 100);
    const subscription = dashboard.subscribeToEvent(SceneObjectStateChangedEvent, (event) => {
      if (DashboardSceneChangeTracker.isUpdatingPersistedState(event)) {
        invalidate();
      }
    });
    const actionsSubscription = dashboard.subscribeToEvent(DashboardStateChangedEvent, invalidate);
    return () => {
      actionsSubscription.unsubscribe();
      subscription.unsubscribe();
      invalidate.cancel();
    };
  }, [dashboard]);

  const recomputeKey = JSON.stringify([
    revision,
    mode,
    saveTimeRange,
    saveVariables,
    saveRefresh,
    draft?.title,
    draft?.description,
    draft?.copyTags,
    metadata,
  ]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      // Yield a macrotask so the loading state paints before the synchronous work below.
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (cancelled) {
        return;
      }

      const input = buildReviewInput(latest.current);
      await preloadPanelPlugins([input.baseline, input.payload]);
      if (cancelled) {
        return;
      }

      const summary = summarizeDashboardChanges({ ...input, getPlugin: syncGetPanelPlugin });
      if (!cancelled) {
        setResult({ key: recomputeKey, state: { status: 'ready', summary } });
      }
    };

    run().catch((error: unknown) => {
      logError(error instanceof Error ? error : new Error(String(error)), { source: 'dashboard-review-summary' });
      if (!cancelled) {
        setResult({ key: recomputeKey, state: { status: 'error' } });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [recomputeKey]);

  if (result?.key === recomputeKey) {
    return result.state;
  }
  return result?.state.status === 'ready' ? { ...result.state, refreshing: true } : { status: 'loading' };
}

function buildReviewInput({
  dashboard,
  mode,
  draft,
  metadata,
  saveTimeRange,
  saveVariables,
  saveRefresh,
}: UseReviewSummaryOptions): ReviewInput {
  // Read now rather than from the drawer's last render, which may predate the edit that triggered this
  const { initialSaveModel, changedSaveModel } = dashboard.getDashboardChanges(
    saveTimeRange,
    saveVariables,
    saveRefresh
  );
  if (!isDashboardV2Spec(initialSaveModel) || !isDashboardV2Spec(changedSaveModel)) {
    throw new Error('Review supports v2 dashboards only');
  }

  const baselineKind = getScenePendingChangePreview(dashboard.state)?.previewing ? 'pendingChanges' : 'saved';
  const common = { baselineKind, ...(metadata ? { metadata } : {}) } as const;

  if (mode === 'save') {
    return { ...common, mode, baseline: initialSaveModel, payload: changedSaveModel };
  }

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

async function preloadPanelPlugins(specs: Array<DashboardV2Spec | null>) {
  const ids = new Set<string>();
  for (const spec of specs) {
    for (const element of Object.values(spec?.elements ?? {})) {
      if (element.kind === 'Panel' && element.spec.vizConfig.group) {
        ids.add(element.spec.vizConfig.group);
      }
    }
  }

  const missing = [...ids].filter((id) => !syncGetPanelPlugin(id));
  if (missing.length === 0) {
    return;
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, PLUGIN_PRELOAD_TIMEOUT_MS);
  });
  // allSettled: a plugin that fails to load only costs its labels.
  await Promise.race([Promise.allSettled(missing.map((id) => importPanelPlugin(id))), timeout]);
  clearTimeout(timer);
}
