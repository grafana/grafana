import { useEffect, useRef, useSyncExternalStore } from 'react';

import { t } from '@grafana/i18n';
import { reportInteraction, usePluginComponent } from '@grafana/runtime';
import { useAppNotification } from 'app/core/copy/appNotification';
import {
  acquireDashboardEditLock,
  type DashboardEditLockHandle,
} from 'app/features/dashboard-edit-lock/dashboardEditLockState';

import {
  clearDashboardGeneration,
  getDashboardGenerationPhase,
  startDashboardGeneration,
  subscribeToDashboardGeneration,
  type DashboardGenerationRequest,
} from './generationState';
import { buildRepairPrompt } from './prompts';
import { validateGeneratedDashboard } from './validateGeneratedDashboard';

const BUILDER_COMPONENT_ID = 'grafana-assistant-app/headless-dashboard-builder/v0';

/** How many automatic post-build repair passes to attempt before giving up. */
const MAX_REPAIR_PASSES = 1;

/** Props contract of the assistant plugin's exposed headless builder component. */
interface HeadlessDashboardBuilderProps {
  /** Omitted while prewarming; the build starts once it is set. */
  buildPrompt?: string;
  origin?: string;
  /** 'new' (default) builds a fresh dashboard; 'current' improves the open one. */
  target?: 'new' | 'current';
  /** Open the build's conversation in the assistant sidebar as soon as it starts. */
  openInAssistant?: boolean;
  onStatus?: (status: string) => void;
  onComplete?: (summary: string, controls?: { openInAssistant?: () => void }) => void;
  onError?: (error: string) => void;
}

/**
 * App-level host for the dashboard wizard's headless generation. While a
 * generation is pending it mounts the assistant plugin's invisible headless
 * builder, whose agent builds directly in the live editor scene. The build's
 * conversation opens in the assistant sidebar right away (so the user can
 * follow the agent's narration and tool calls), while a dashboard edit lock
 * dims the content area and blocks manual edits — concurrent edits would
 * corrupt the build. When the build finishes, the lock lifts and the
 * finished dashboard is left in the editor — dirty and unsaved — with the
 * conversation still open for follow-ups.
 *
 * During the wizard's prewarm phase the builder is mounted without a prompt,
 * which lets the assistant pre-create the chat session the build will use.
 * The builder element stays in the same tree position across the prewarm →
 * active transition so React updates it in place rather than remounting.
 */
export function DashboardGenerationHost() {
  const phase = useSyncExternalStore(subscribeToDashboardGeneration, getDashboardGenerationPhase);

  if (phase.status === 'idle') {
    return null;
  }

  return (
    <DashboardGenerationSurface
      origin={phase.status === 'active' ? phase.request.origin : phase.origin}
      request={phase.status === 'active' ? phase.request : null}
    />
  );
}

function DashboardGenerationSurface({
  origin,
  request,
}: {
  origin: string;
  request: DashboardGenerationRequest | null;
}) {
  const notifyApp = useAppNotification();

  const { component: Builder, isLoading } = usePluginComponent<HeadlessDashboardBuilderProps>(BUILDER_COMPONENT_ID);

  // A missing builder only matters once the user actually asked to build;
  // during prewarm we just silently skip the warm-up.
  const builderMissing = !isLoading && !Builder && request !== null;
  useEffect(() => {
    if (builderMissing) {
      notifyApp.error(
        t('dashboard-wizard.generation.failed-title', 'Dashboard generation failed'),
        t('dashboard-wizard.generation.assistant-unavailable', 'The Grafana Assistant is not available.')
      );
      clearDashboardGeneration();
    }
  }, [builderMissing, notifyApp]);

  // The edit lock dims the content area (never the assistant sidebar) and
  // blocks manual edits while the agent mutates the live scene. It is keyed
  // on "a build is running" rather than on the request so an automatic
  // repair pass — which swaps the request synchronously in handleComplete —
  // holds one continuous lock with no flicker.
  const isBuilding = request !== null;
  const isImproving = request?.target === 'current';
  const lockRef = useRef<DashboardEditLockHandle | null>(null);
  useEffect(() => {
    if (!isBuilding) {
      return;
    }
    const label = isImproving
      ? t('dashboard-wizard.generation.title-improve', 'Improving your dashboard')
      : t('dashboard-wizard.generation.title', 'Building your dashboard');
    // Cancelling clears the generation state, which unmounts the builder —
    // and unmounting cancels the run on the assistant side.
    const lock = acquireDashboardEditLock({ label, onCancel: clearDashboardGeneration });
    lockRef.current = lock;
    return () => {
      lockRef.current = null;
      lock.release();
    };
    // The label must not swap mid-build when a repair pass (target 'current')
    // replaces a 'new' build's request; only lock on build start/end.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBuilding]);

  const handleStatus = (status: string) => {
    lockRef.current?.setStatus(status);
  };

  // By completion the finished dashboard is already open in the editor (for
  // fresh builds the agent navigated there itself) and its conversation is
  // showing in the assistant sidebar, so the host just releases the lock.
  const handleComplete = (summary: string, controls?: { openInAssistant?: () => void }) => {
    if (request === null) {
      return;
    }

    // Deterministically check the freshly built scene for problems the agent
    // commonly leaves behind (queries referencing undefined variables). If we
    // find any and haven't exhausted our repair budget, run one corrective
    // pass against the now-open dashboard instead of finishing.
    const attempt = request.repairAttempt ?? 0;
    const issues = validateGeneratedDashboard();
    if (issues.undefinedVariables.length > 0 && attempt < MAX_REPAIR_PASSES) {
      reportInteraction('dashboard_wizard_repair', {
        attempt: attempt + 1,
        undefinedVariables: issues.undefinedVariables.length,
      });
      startDashboardGeneration({
        origin: request.origin,
        target: 'current',
        prompt: buildRepairPrompt(issues),
        repairAttempt: attempt + 1,
      });
      return;
    }

    // With an up-to-date assistant plugin the conversation opened at build
    // start and this is an idempotent no-op switch; with an older plugin it
    // is the first time the sidebar opens, showing the final summary.
    controls?.openInAssistant?.();
    clearDashboardGeneration();
  };

  const handleError = (error: string) => {
    notifyApp.error(t('dashboard-wizard.generation.failed-title', 'Dashboard generation failed'), error);
    clearDashboardGeneration();
  };

  if (!Builder) {
    return null;
  }

  return (
    <Builder
      buildPrompt={request?.prompt}
      origin={origin}
      target={request?.target}
      openInAssistant={true}
      onStatus={handleStatus}
      onComplete={handleComplete}
      onError={handleError}
    />
  );
}
