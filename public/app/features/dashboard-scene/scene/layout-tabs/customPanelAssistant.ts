import {
  type ChatContextItem,
  createAssistantContextItem,
  type OpenAssistantProps,
  useAssistant,
} from '@grafana/assistant';
import { usePanelPluginMeta } from '@grafana/runtime/internal';

import { type DashboardScene } from '../DashboardScene';

export const CUSTOM_PANEL_PLUGIN_ID = 'custom-panel';
export const CUSTOM_PANEL_ASSISTANT_ORIGIN = 'grafana/dashboards/custom-panel-landing';

// The prompts are instructions to the Assistant, not UI copy, so they stay in English whatever the
// UI locale (like AnalyzeRuleButton).

/** Asks the Assistant to build a landing page for the dashboard. */
export function buildLandingPageRequest(dashboard: DashboardScene): OpenAssistantProps {
  return buildRequest(dashboard, 'Create a landing page for this dashboard.');
}

/** Asks the Assistant to restyle one tab of the dashboard. */
export function buildRestyleTabRequest(dashboard: DashboardScene, tabTitle: string): OpenAssistantProps {
  return buildRequest(dashboard, `Restyle the ${tabTitle} tab of this dashboard.`);
}

function buildRequest(dashboard: DashboardScene, prompt: string): OpenAssistantProps {
  return {
    origin: CUSTOM_PANEL_ASSISTANT_ORIGIN,
    // The mode that edits dashboards and draws Custom panels.
    mode: 'dashboarding',
    prompt,
    context: dashboardContext(dashboard),
    autoSend: true,
  };
}

function dashboardContext(dashboard: DashboardScene): ChatContextItem[] {
  const { uid, title, meta } = dashboard.state;
  // A dashboard that was never saved has no uid; the Assistant still reads it from the page.
  if (!uid) {
    return [];
  }
  return [
    createAssistantContextItem('dashboard', {
      dashboardUid: uid,
      dashboardTitle: title,
      ...(meta.folderUid && { folderUid: meta.folderUid }),
      ...(meta.folderTitle && { folderTitle: meta.folderTitle }),
    }),
  ];
}

/**
 * Whether the Custom panel is registered (alpha panels and its feature flag on), and how to open the
 * Assistant, which is undefined while the Assistant is not available.
 */
export function useCustomPanelAssistant(): {
  customPanelAvailable: boolean;
  openAssistant?: (props: OpenAssistantProps) => void;
} {
  const { value: customPanelMeta } = usePanelPluginMeta(CUSTOM_PANEL_PLUGIN_ID);
  const { isAvailable, openAssistant } = useAssistant();
  return {
    customPanelAvailable: Boolean(customPanelMeta),
    openAssistant: isAvailable && openAssistant ? openAssistant : undefined,
  };
}
