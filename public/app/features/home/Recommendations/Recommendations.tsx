import { useMemo } from 'react';
import { useAsync } from 'react-use';

import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { type LocalPlugin } from 'app/features/plugins/admin/types';
import { AccessControlAction } from 'app/types/accessControl';

import { RecommendationsSkeleton } from './RecommendationsSkeleton';
import { RecommendationsView } from './RecommendationsView';
import { fetchInstalledPlugins, getRecommendationCards, type PluginRecommendationCard } from './pluginRecommendations';
import { useSolutionState } from './solutionState';
import { selectRecommendations } from './solutionsMatrix';
import { type RecommendationItem } from './types';

export function Recommendations() {
  const canInstall = contextSrv.hasPermission(AccessControlAction.PluginsInstall) && config.pluginAdminEnabled;
  // Unscoped pre-gate only; each card re-checks its own scoped permission. Recommendations are a
  // plugin + connection surface: plugin management or datasource creation both qualify, and the
  // pre-gate spares every other viewer the /api/plugins fetch and the solution probes.
  const canWriteSome = contextSrv.hasPermission(AccessControlAction.PluginsWrite);
  const canCreateDataSources = contextSrv.hasPermission(AccessControlAction.DataSourcesCreate);
  if (!canInstall && !canWriteSome && !canCreateDataSources) {
    return null;
  }
  return <GatedRecommendations canInstall={canInstall} />;
}

interface GatedRecommendationsProps {
  canInstall: boolean;
}

function toEnableItem(recommendation: PluginRecommendationCard): RecommendationItem {
  return { ...recommendation, cta: 'enable' };
}

// Enabled-but-silent app: the CTA leads into the app to finish setup, not to the catalog.
function toSetupItem(recommendation: PluginRecommendationCard): RecommendationItem {
  return { ...recommendation, action: recommendation.setupAction, href: recommendation.appHref, cta: 'setup' };
}

function mapPluginsById(plugins: LocalPlugin[] = []) {
  return new Map(plugins.map((plugin) => [plugin.id, plugin]));
}

function GatedRecommendations({ canInstall }: GatedRecommendationsProps) {
  const { value: installedPlugins, loading: pluginsLoading } = useAsync(fetchInstalledPlugins, []);
  const pluginsById = useMemo(() => mapPluginsById(installedPlugins), [installedPlugins]);

  const { value: resolution, loading: stateLoading } = useSolutionState();
  const selection = resolution ? selectRecommendations(resolution.state) : undefined;

  const cardsById = getRecommendationCards();
  const selectedCards = selection?.cards.map((id) => cardsById[id]) ?? [];

  // An unavailable plugin list fails closed (plugin cards only). /api/plugins always lists at
  // least the core plugins, so an empty response means the list is unreliable and also fails closed.
  const listReady = !pluginsLoading && !!installedPlugins && installedPlugins.length > 0;

  const recommendations = selectedCards.flatMap((card): RecommendationItem[] => {
    if (card.kind === 'connection') {
      // Independent of the plugin list: a failing /api/plugins must not hide a connection card.
      return contextSrv.hasPermission(AccessControlAction.DataSourcesCreate) ? [{ ...card, cta: 'enable' }] : [];
    }
    if (!listReady) {
      return [];
    }
    const plugin = pluginsById.get(card.pluginId);
    if (!plugin) {
      // Unlistable plugins take the install-only path.
      return canInstall ? [toEnableItem(card)] : [];
    }
    if (plugin.enabled) {
      // Selection already established the solution is silent; the setup CTA leads into the app,
      // so it only renders for users who can open it.
      return contextSrv.hasPermissionInMetadata(AccessControlAction.PluginsAppAccess, plugin)
        ? [toSetupItem(card)]
        : [];
    }
    // plugins:write is scoped to this plugin.
    return contextSrv.hasPermissionInMetadata(AccessControlAction.PluginsWrite, plugin) ? [toEnableItem(card)] : [];
  });

  // The region always renders once state settles; recommendations only decide the right column.
  // Hold the skeleton while a selected plugin card still waits on the plugin list.
  const waitingOnPlugins = pluginsLoading && selectedCards.some((card) => card.kind === 'plugin');
  if (stateLoading || !selection || waitingOnPlugins) {
    return <RecommendationsSkeleton />;
  }

  return <RecommendationsView recommendations={recommendations} startingState={selection.baseRow} />;
}
