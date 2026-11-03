import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';

/**
 * Whether plugin-provided pending changes are on: `assistant.dashboard.artifacts`, the flag Grafana
 * Assistant gates its own side with, so one flag turns both on. While it is off, Grafana asks no
 * plugin for pending changes, and neither `RELOAD_FROM_SERVER` nor the `grafana/dashboard-view/v1`
 * component exists, which is also how a plugin tells this build can't preview its changes.
 *
 * Kept apart from pendingChangePreview.ts so the mutation command registries can read it without
 * importing the plugin loading that module does.
 */
export function isPendingChangesEnabled(): boolean {
  return getFeatureFlagClient().getBooleanValue(FlagKeys.AssistantDashboardArtifacts, false);
}

/** The mutation commands that exist only for pending changes. */
export const PENDING_CHANGES_COMMANDS: ReadonlySet<string> = new Set(['RELOAD_FROM_SERVER']);
