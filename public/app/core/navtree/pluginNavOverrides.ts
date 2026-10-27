import { type NavModelItem } from '@grafana/data';
import {
  ADAPTIVE_TELEMETRY_UMBRELLA_APP_ID,
  APP_OBSERVABILITY_APP_ID,
  ASSISTANT_APP_ID,
  ASSISTANT_ONBOARDING_APP_ID,
  DOCS_PLUGIN_APP_ID,
  MAINTENANCE_WINDOWS_APP_ID,
  PATHFINDER_APP_ID,
  SERVICECENTER_APP_ID,
  SLO_APP_ID,
} from 'app/core/appPluginIds';

import { ASSERTS_SERVICES_PATH, SLO_SERVICES_PATH } from './appNavConfig';
import { NavID, NavWeight } from './constants';
import {
  findNavById,
  hoistedPluginPageId,
  pluginPageId,
  removeNavById,
  standalonePluginPageId,
  updateNavById,
} from './utils';

/**
 * A cross-plugin adjustment applied after all app plugins have been merged
 * into the tree. Each override declares when it applies (based on the merged
 * tree and the installed plugin set) and returns a new, adjusted tree.
 */
export interface PluginNavOverride {
  when: (tree: NavModelItem[], installedPluginIds: ReadonlySet<string>) => boolean;
  apply: (tree: NavModelItem[], installedPluginIds: ReadonlySet<string>) => NavModelItem[];
}

export const PLUGIN_NAV_OVERRIDES: PluginNavOverride[] = [
  {
    // When assistant onboarding is installed, but main Assistant plugin is not,
    // we show a stub Assistant entry where the real app would live
    when: (_, installedPluginIds) =>
      installedPluginIds.has(ASSISTANT_ONBOARDING_APP_ID) && !installedPluginIds.has(ASSISTANT_APP_ID),
    apply: (tree) => [
      ...tree,
      {
        text: 'Assistant',
        id: pluginPageId(ASSISTANT_APP_ID),
        subTitle: 'AI-powered assistant for Grafana',
        icon: 'ai-sparkle',
        sortWeight: NavWeight.assistant,
        isSection: true,
        pluginId: ASSISTANT_APP_ID,
        url: `/a/${ASSISTANT_APP_ID}`,
      },
    ],
  },
  {
    // When the umbrella Adaptive Telemetry app is installed, the section
    // header itself links to it.
    when: (_, installedPluginIds) => installedPluginIds.has(ADAPTIVE_TELEMETRY_UMBRELLA_APP_ID),
    apply: (tree) =>
      updateNavById(tree, NavID.adaptiveTelemetry, (section) => ({
        ...section,
        url: `/a/${ADAPTIVE_TELEMETRY_UMBRELLA_APP_ID}`,
        pluginId: ADAPTIVE_TELEMETRY_UMBRELLA_APP_ID,
      })),
  },
  {
    // When the App Observability plugin is present it owns the "Application"
    // entry in the Observability section, so hide the asserts equivalent.
    when: (tree) => Boolean(findNavById(tree, pluginPageId(APP_OBSERVABILITY_APP_ID))),
    apply: (tree) =>
      updateNavById(tree, NavID.observability, (section) => ({
        ...section,
        children: (section.children ?? []).filter((child) => child.id !== hoistedPluginPageId(ASSERTS_SERVICES_PATH)),
      })),
  },
  {
    // Maintenance windows renders as a page of the SLO app rather than its own
    // app entry. If that empties the Apps section, pruneEmptyNavSections drops it.
    when: (tree) =>
      Boolean(findNavById(tree, pluginPageId(SLO_APP_ID))) &&
      Boolean(findNavById(tree, pluginPageId(MAINTENANCE_WINDOWS_APP_ID))),
    apply: (tree) => {
      const mwNode = findNavById(tree, pluginPageId(MAINTENANCE_WINDOWS_APP_ID));
      if (!mwNode) {
        return tree;
      }
      const withoutMaintenanceWindows = removeNavById(tree, pluginPageId(MAINTENANCE_WINDOWS_APP_ID));
      return updateNavById(withoutMaintenanceWindows, pluginPageId(SLO_APP_ID), (sloNode) => ({
        ...sloNode,
        children: [
          ...(sloNode.children ?? []),
          {
            ...mwNode,
            id: standalonePluginPageId(MAINTENANCE_WINDOWS_APP_ID),
            // Fall back to the appended position so it sorts last among SLO's child pages
            sortWeight: 0,
          },
        ],
      }));
    },
  },
  {
    // Service Center is provided by the SLO plugin when the dedicated
    // servicecenter app is not installed.
    when: (tree, installedPluginIds) =>
      Boolean(findNavById(tree, pluginPageId(SLO_APP_ID))) && !installedPluginIds.has(SERVICECENTER_APP_ID),
    apply: (tree) =>
      updateNavById(tree, NavID.alertsAndIncidents, (section) => ({
        ...section,
        children: [
          ...(section.children ?? []),
          {
            text: 'Service Center',
            id: standalonePluginPageId('slo-services'),
            subTitle:
              'Centralizes service-level operational data including SLOs, alerts, and incidents by grouping resources through shared labels or tags',
            url: SLO_SERVICES_PATH,
            sortWeight: 1,
            isNew: true,
          },
        ],
      })),
  },
  {
    // The Help entry opens the interactive learning plugin when it is installed
    when: (_, installedPluginIds) =>
      installedPluginIds.has(PATHFINDER_APP_ID) || installedPluginIds.has(DOCS_PLUGIN_APP_ID),
    apply: (tree) => updateNavById(tree, NavID.help, (help) => ({ ...help, hideFromTabs: true })),
  },
];
