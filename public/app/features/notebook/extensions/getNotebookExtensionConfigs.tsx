/* eslint-disable @grafana/i18n/no-untranslated-strings -- extension configs are registered at bootstrap, before i18n is ready (same as getExploreExtensionConfigs) */
import { type PluginExtensionAddedLinkConfig, PluginExtensionPoints } from '@grafana/data';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import { contextSrv } from 'app/core/services/context_srv';
import { createAddedLinkConfig } from 'app/features/plugins/extensions/utils';
import { AccessControlAction } from 'app/types/accessControl';

import { type PluginExtensionExploreContext } from '../../explore/extensions/ToolbarExtensionPoint';
import { getLastUsedNotebook } from '../model/lastUsedNotebook';

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
    ];
  } catch (error) {
    console.warn('Could not configure notebook extensions', error);
    return [];
  }
}
