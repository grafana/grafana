import { useAsync } from 'react-use';

import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { RecommendationsView } from './RecommendationsView';
import { fetchInstalledPlugins, getRecommendations } from './pluginRecommendations';

export function Recommendations() {
  const canInstall = contextSrv.hasPermission(AccessControlAction.PluginsInstall) && config.pluginAdminEnabled;
  // Unscoped pre-gate only; each disabled card re-checks plugins:write scoped to its own plugin.
  const canWriteSome = contextSrv.hasPermission(AccessControlAction.PluginsWrite);
  if (!canInstall && !canWriteSome) {
    return null;
  }
  return <GatedRecommendations canInstall={canInstall} />;
}

interface GatedRecommendationsProps {
  canInstall: boolean;
}

function GatedRecommendations({ canInstall }: GatedRecommendationsProps) {
  const { value: installedPlugins, loading: pluginsLoading } = useAsync(fetchInstalledPlugins, []);

  // An unavailable plugin list fails closed. /api/plugins always lists at least the core plugins,
  // so an empty response means the list is unreliable and also fails closed.
  if (pluginsLoading || !installedPlugins || installedPlugins.length === 0) {
    return null;
  }

  const pluginsById = new Map(installedPlugins.map((plugin) => [plugin.id, plugin]));
  const pluginRecommendations = getRecommendations().filter((recommendation) => {
    const plugin = pluginsById.get(recommendation.pluginId);
    if (!plugin) {
      // Unlistable plugins take the install-only path.
      return canInstall;
    }
    if (plugin.enabled) {
      return false;
    }
    // plugins:write is scoped to this plugin.
    return contextSrv.hasPermissionInMetadata(AccessControlAction.PluginsWrite, plugin);
  });

  const recommendations = pluginRecommendations;
  if (recommendations.length === 0) {
    return null;
  }

  return <RecommendationsView recommendations={recommendations} />;
}
