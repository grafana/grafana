import { useRef } from 'react';
import { useAsync } from 'react-use';

import { config } from '@grafana/runtime';
import { useStoredBoolean } from 'app/core/hooks/useStoredBoolean';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { RecommendationsSkeleton } from './RecommendationsSkeleton';
import { RecommendationsView } from './RecommendationsView';
import { fetchInstalledPlugins, getRecommendationCards, type PluginRecommendationCard } from './pluginRecommendations';
import { useSolutionState } from './solutionState';
import { selectRecommendations } from './solutionsMatrix';
import { type RecommendationItem } from './types';

const HOME_RECOMMENDATIONS_COLLAPSED_LOCAL_STORAGE_KEY = 'grafana.home.recommendations.collapsed';

export function Recommendations() {
  const canInstall = contextSrv.hasPermission(AccessControlAction.PluginsInstall) && config.pluginAdminEnabled;
  // Unscoped pre-gate; each card re-checks its scoped permission. Plugin management or
  // datasource creation qualifies — everyone else is spared the fetches and probes.
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

function GatedRecommendations({ canInstall }: GatedRecommendationsProps) {
  const [collapsed, setCollapsed] = useStoredBoolean(HOME_RECOMMENDATIONS_COLLAPSED_LOCAL_STORAGE_KEY, false);
  // A stored collapsed preference must not fire the probes or the plugin fetch. Monotonic
  // render-time latch: expanding never commits an ungated frame, re-collapsing never refetches.
  const everExpanded = useRef(!collapsed);
  if (!collapsed) {
    everExpanded.current = true;
  }
  const probesEnabled = everExpanded.current;

  const plugins = useAsync(async () => (probesEnabled ? fetchInstalledPlugins() : undefined), [probesEnabled]);
  const pluginsById = new Map((plugins.value ?? []).map((plugin) => [plugin.id, plugin]));
  // Derived from the settled value, not the loading flag: on the probesEnabled flip, useAsync
  // still reports the gated run's state for one frame, which must read as pending.
  const pluginsSettled = !!plugins.value || !!plugins.error;

  const { value: resolution } = useSolutionState(probesEnabled);
  const selection = resolution ? selectRecommendations(resolution.state) : undefined;

  const cardsById = getRecommendationCards();
  const selectedCards = selection?.cards.map((id) => cardsById[id]) ?? [];

  // An unavailable plugin list fails closed (plugin cards only). /api/plugins always lists at
  // least the core plugins, so an empty response means the list is unreliable and also fails closed.
  const listReady = !!plugins.value && plugins.value.length > 0;

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

  // The region renders once state settles; recommendations only decide the right column.
  // Collapsed (gated-off) renders immediately as just the header row.
  const waitingOnPlugins = !pluginsSettled && selectedCards.some((card) => card.kind === 'plugin');
  if (probesEnabled && (!selection || waitingOnPlugins)) {
    return <RecommendationsSkeleton />;
  }

  return (
    <RecommendationsView
      recommendations={recommendations}
      startingState={selection?.baseRow ?? 'unknown'}
      collapsed={collapsed}
      setCollapsed={setCollapsed}
    />
  );
}
