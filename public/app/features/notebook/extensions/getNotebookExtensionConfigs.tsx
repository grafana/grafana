/* eslint-disable @grafana/i18n/no-untranslated-strings -- extension configs are registered at bootstrap, before i18n is ready (same as getExploreExtensionConfigs) */
import { type PluginExtensionAddedLinkConfig, PluginExtensionPoints } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import { contextSrv } from 'app/core/services/context_srv';
import { createAddedLinkConfig } from 'app/features/plugins/extensions/utils';
import { AccessControlAction } from 'app/types/accessControl';

import { type PluginExtensionExploreContext } from '../../explore/extensions/ToolbarExtensionPoint';
import { createNotebook, notebookEditUrl } from '../api/notebookAPI';
import { getLastUsedNotebook } from '../model/lastUsedNotebook';
import { markNotebookAsNew } from '../model/newNotebookSignal';
import { DEFAULT_NOTEBOOK_TITLE, newNotebookSpec } from '../model/notebookSpec';

/** Title shared by the sidebar added link and added component (the sidebar matches them by title). */
export const NOTEBOOKS_SIDEBAR_COMPONENT_TITLE = 'Notebooks';

// The Alerts & IRM landing page renders extension links from this point as cards —
// the lightweight IRM entry point into notebooks.
const IRM_LANDING_CARDS_EXTENSION_POINT = 'grafana/dynamic/nav-landing-page/nav-id-alerts-and-incidents/cards/v1';

function notebooksEnabled(): boolean {
  return getFeatureFlagClient().getBooleanValue(FlagKeys.DashboardNotebooks, false);
}

function canEditNotebooks(): boolean {
  return (
    contextSrv.hasPermission(AccessControlAction.DashboardsCreate) ||
    contextSrv.hasPermission(AccessControlAction.DashboardsWrite)
  );
}

export function getNotebookExtensionConfigs(): PluginExtensionAddedLinkConfig[] {
  try {
    return [
      // Explore toolbar → "Add to notebook" (sibling of the core "Add to dashboard" action).
      createAddedLinkConfig<PluginExtensionExploreContext>({
        title: 'Add to notebook',
        description: 'Capture the current query and visualization as a live panel in a notebook',
        targets: [PluginExtensionPoints.ExploreToolbarAction],
        icon: 'book-open',
        category: 'Notebooks',
        configure: () => {
          if (!notebooksEnabled() || !canEditNotebooks()) {
            return undefined;
          }
          return {};
        },
        onClick: async (_, { context, openModal }) => {
          if (!context?.exploreId) {
            return;
          }
          const { ExploreAddToNotebook } = await import('app/features/notebook/addToNotebook/ExploreAddToNotebook');
          openModal({
            title: 'Add to notebook',
            body: ({ onDismiss }) => <ExploreAddToNotebook exploreId={context.exploreId} onClose={onDismiss!} />,
          });
        },
      }),

      // Explore toolbar → one-click append to the most recently used notebook.
      // Title is overridden in configure to match the dashboard panel menu:
      // `Add to "<notebook name>"` (truncated).
      createAddedLinkConfig<PluginExtensionExploreContext>({
        title: 'Add to last notebook',
        description: 'Append the current query to your most recent notebook without any dialogs',
        targets: [PluginExtensionPoints.ExploreToolbarAction],
        icon: 'bolt',
        category: 'Notebooks',
        configure: () => {
          if (!notebooksEnabled() || !canEditNotebooks()) {
            return undefined;
          }
          const lastUsed = getLastUsedNotebook();
          if (!lastUsed) {
            return undefined;
          }
          const shortTitle = lastUsed.title.length > 25 ? `${lastUsed.title.slice(0, 25)}…` : lastUsed.title;
          return {
            title: `Add to "${shortTitle}"`,
            description: `Append the current query to "${lastUsed.title}"`,
          };
        },
        onClick: async (_, { context }) => {
          if (!context?.exploreId) {
            return;
          }
          const { quickAddExploreToLastNotebook } = await import(
            'app/features/notebook/addToNotebook/quickAddFromExplore'
          );
          await quickAddExploreToLastNotebook(context.exploreId);
        },
      }),

      // Extension sidebar ("workspace") → notebooks panel docked next to any page.
      // The sidebar requires a link and a component with the same title; the component
      // is registered in the plugin extension registry setup.
      createAddedLinkConfig({
        title: NOTEBOOKS_SIDEBAR_COMPONENT_TITLE,
        description: 'Browse notebooks and capture quick notes alongside any Grafana page',
        targets: [PluginExtensionPoints.ExtensionSidebar],
        icon: 'book-open',
        configure: () => (notebooksEnabled() ? {} : undefined),
        onClick: (_, { openSidebar }) => {
          openSidebar(NOTEBOOKS_SIDEBAR_COMPONENT_TITLE);
        },
      }),

      // Alerts & IRM landing page card → notebooks as the incident note-taking surface.
      createAddedLinkConfig({
        title: 'Notebooks',
        description: 'Capture incident investigation notes with live panels and share findings with your team',
        targets: [IRM_LANDING_CARDS_EXTENSION_POINT],
        icon: 'book-open',
        configure: () => (notebooksEnabled() ? {} : undefined),
        onClick: () => {
          locationService.push('/notebooks');
        },
      }),

      // Command palette → quick "New notebook" from anywhere (matches "New dashboard").
      createAddedLinkConfig({
        title: 'New notebook',
        description: 'Create a new notebook to capture an investigation',
        targets: [PluginExtensionPoints.CommandPalette],
        icon: 'book-open',
        category: 'Notebooks',
        configure: () => {
          if (!notebooksEnabled() || !canEditNotebooks()) {
            return undefined;
          }
          return {};
        },
        onClick: async () => {
          const created = await createNotebook(newNotebookSpec(DEFAULT_NOTEBOOK_TITLE));
          markNotebookAsNew(created.metadata.name);
          locationService.push(notebookEditUrl(created.metadata.name));
        },
      }),
    ];
  } catch (error) {
    console.warn('Could not configure notebook extensions', error);
    return [];
  }
}
