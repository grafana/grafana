import { createBridgeURL } from 'app/features/alerting/unified/components/PluginBridge';
import { canAccessPluginPage, useIrmPlugin } from 'app/features/alerting/unified/hooks/usePluginBridge';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';

/** IRM's declare form. Also the page the access check is made against — see below. */
export const DECLARE_INCIDENT_PATH = '/incidents/declare';

interface NotebookIncidents {
  /** IRM, or the legacy Incident app on a stack that has not migrated. */
  pluginId: string;
  /** Whether to offer the incident actions at all. False while the probe is still in flight. */
  available: boolean;
}

/**
 * Whether this notebook can talk to IRM, asked once for the whole toolbar.
 *
 * Both entry points need the same answer, and asking here rather than in each of them means the
 * plugin is probed once per page instead of once per control.
 *
 * Unavailable covers three cases the toolbar treats alike, because the outcome is the same either
 * way — nothing to offer: still probing, not installed, or installed but not this user's to open.
 * Declare navigates to the plugin page the check is made against; attach only posts to the plugin's
 * resource proxy, but gating it on the same page keeps one notion of "has IRM" rather than letting
 * someone attach to incidents they cannot then go and read.
 */
export function useNotebookIncidents(): NotebookIncidents {
  const { pluginId, installed, settings } = useIrmPlugin(SupportedPlugin.Incident);

  const available = Boolean(
    installed && settings && canAccessPluginPage(settings, createBridgeURL(pluginId, DECLARE_INCIDENT_PATH))
  );

  return { pluginId, available };
}
