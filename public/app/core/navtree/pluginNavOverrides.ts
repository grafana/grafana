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
 * The app plugins an override may ask about. Two sets, because the Go builder
 * asks different questions of each: `accessible` is the set it builds after the
 * per-plugin access check (enabledAccessibleAppPluginMap), while `installed`
 * includes apps the user cannot reach, which is what it reads for the assistant
 * flags and the interactive learning check. Each override says which it means.
 */
export interface PluginSets {
  installed: ReadonlySet<string>;
  accessible: ReadonlySet<string>;
}

/**
 * A cross-plugin adjustment applied after all app plugins have been merged
 * into the tree. Each override declares when it applies (based on the merged
 * tree and the plugin sets) and returns a new, adjusted tree.
 */
export interface PluginNavOverride {
  when: (tree: NavModelItem[], plugins: PluginSets) => boolean;
  apply: (tree: NavModelItem[], plugins: PluginSets) => NavModelItem[];
}

export const PLUGIN_NAV_OVERRIDES: PluginNavOverride[] = [
  {
    // When assistant onboarding is installed, but main Assistant plugin is not,
    // we show a stub Assistant entry where the real app would live
    // Installed, not accessible: the Go builder sets its assistant flags before
    // the per-plugin access check, so the stub shows either way
    when: (_, { installed }) => installed.has(ASSISTANT_ONBOARDING_APP_ID) && !installed.has(ASSISTANT_APP_ID),
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
    // Accessible, since this points the section header at the app: the Go
    // builder reads enabledAccessibleAppPluginMap here
    when: (_, { accessible }) => accessible.has(ADAPTIVE_TELEMETRY_UMBRELLA_APP_ID),
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
    // Installed: the Go builder asks the plugin store whether the dedicated app
    // exists at all, access aside, before standing in for it
    when: (tree, { installed }) =>
      Boolean(findNavById(tree, pluginPageId(SLO_APP_ID))) && !installed.has(SERVICECENTER_APP_ID),
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
    // Installed, matching the Go builder, which checks the plugin store directly
    when: (_, { installed }) => installed.has(PATHFINDER_APP_ID) || installed.has(DOCS_PLUGIN_APP_ID),
    apply: (tree) => updateNavById(tree, NavID.help, (help) => ({ ...help, hideFromTabs: true })),
  },
];
