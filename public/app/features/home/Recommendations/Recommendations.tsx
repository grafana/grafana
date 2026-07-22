import { useAsync } from 'react-use';

import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { RecommendationsView } from './RecommendationsView';
import { fetchInstalledPlugins, getRecommendations, type PluginRecommendationItem } from './pluginRecommendations';
import { hasSolutionData } from './solutionDataProbes';
import { type RecommendationItem } from './types';

export function Recommendations() {
  const canInstall = contextSrv.hasPermission(AccessControlAction.PluginsInstall) && config.pluginAdminEnabled;
  // Unscoped pre-gate only; each disabled card re-checks plugins:write scoped to its own plugin.
  // Deliberate limitation: users with only app access (no plugins:write/install anywhere) do not
  // see the section at all — recommendations are a plugin-management surface, and the pre-gate
  // spares every viewer the /api/plugins fetch and the solution data probes.
  const canWriteSome = contextSrv.hasPermission(AccessControlAction.PluginsWrite);
  if (!canInstall && !canWriteSome) {
    return null;
  }
  return <GatedRecommendations canInstall={canInstall} />;
}

interface GatedRecommendationsProps {
  canInstall: boolean;
}

function toEnableItem(recommendation: PluginRecommendationItem): RecommendationItem {
  return { ...recommendation, cta: 'enable' };
}

// Enabled-but-silent app: the CTA leads into the app to finish setup, not to the catalog.
function toSetupItem(recommendation: PluginRecommendationItem): RecommendationItem {
  return { ...recommendation, action: recommendation.setupAction, href: recommendation.appHref, cta: 'setup' };
}

function GatedRecommendations({ canInstall }: GatedRecommendationsProps) {
  const { value: installedPlugins, loading: pluginsLoading } = useAsync(fetchInstalledPlugins, []);

  // Enabled alone does not mean used: probe each enabled recommended solution for live data,
  // and keep recommending the silent ones (preprovisioned cloud stacks enable apps by default).
  const { value: solutionsWithData, loading: probesLoading } = useAsync(async () => {
    if (!installedPlugins) {
      return undefined;
    }
    const pluginsById = new Map(installedPlugins.map((plugin) => [plugin.id, plugin]));
    const enabled = getRecommendations().filter((r) => pluginsById.get(r.pluginId)?.enabled);
    const entries = await Promise.all(
      enabled.map(async (r) => [r.pluginId, await hasSolutionData(r.pluginId)] as const)
    );
    return new Set(entries.filter(([, hasData]) => hasData).map(([pluginId]) => pluginId));
  }, [installedPlugins]);

  // An unavailable plugin list fails closed. /api/plugins always lists at least the core plugins,
  // so an empty response means the list is unreliable and also fails closed.
  if (pluginsLoading || !installedPlugins || installedPlugins.length === 0) {
    return null;
  }

  const pluginsById = new Map(installedPlugins.map((plugin) => [plugin.id, plugin]));
  const recommendations = getRecommendations().flatMap((recommendation): RecommendationItem[] => {
    const plugin = pluginsById.get(recommendation.pluginId);
    if (!plugin) {
      // Unlistable plugins take the install-only path.
      return canInstall ? [toEnableItem(recommendation)] : [];
    }
    if (plugin.enabled) {
      // Pending probes exclude the card for this render instead of blocking the whole
      // section: install/enable cards and the left no-data card mount immediately, and
      // setup cards join once their probe settles.
      if (probesLoading || !solutionsWithData || solutionsWithData.has(recommendation.pluginId)) {
        return [];
      }
      // The setup CTA opens the app, so app access — not plugins:write — is the relevant permission.
      return contextSrv.hasPermissionInMetadata(AccessControlAction.PluginsAppAccess, plugin)
        ? [toSetupItem(recommendation)]
        : [];
    }
    // plugins:write is scoped to this plugin.
    return contextSrv.hasPermissionInMetadata(AccessControlAction.PluginsWrite, plugin)
      ? [toEnableItem(recommendation)]
      : [];
  });

  if (recommendations.length === 0) {
    return null;
  }

  return <RecommendationsView recommendations={recommendations} />;
}
