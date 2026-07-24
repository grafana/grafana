import { useEffect, useMemo, useState } from 'react';
import { useAsync } from 'react-use';

import { store } from '@grafana/data';
import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { type LocalPlugin } from 'app/features/plugins/admin/types';
import { AccessControlAction } from 'app/types/accessControl';

import { RecommendationsSkeleton } from './RecommendationsSkeleton';
import { RecommendationsView } from './RecommendationsView';
import { fetchInstalledPlugins, getRecommendations, type PluginRecommendationItem } from './pluginRecommendations';
import { hasSolutionData } from './solutionDataProbes';
import { type RecommendationItem } from './types';

// Remembers whether the section rendered on the last visit: the loading skeleton only
// shows for users who actually get recommendations, so stacks that resolve to nothing
// never flash a skeleton that collapses into empty space.
const WAS_VISIBLE_KEY = 'grafana.home.recommendations.was-visible';

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

function mapPluginsById(plugins: LocalPlugin[] = []) {
  return new Map(plugins.map((plugin) => [plugin.id, plugin]));
}

function GatedRecommendations({ canInstall }: GatedRecommendationsProps) {
  const { value: installedPlugins, loading: pluginsLoading } = useAsync(fetchInstalledPlugins, []);
  // Memoized so the probe effect below can depend on derived values without re-running every render.
  const pluginsById = useMemo(() => mapPluginsById(installedPlugins), [installedPlugins]);

  // Enabled alone does not mean used: probe each enabled recommended solution for live data,
  // and keep recommending the silent ones (preprovisioned cloud stacks enable apps by default).
  // Only apps the user can open are worth probing — an inaccessible app can never show a setup
  // card, and skipping it avoids doomed requests (e.g. a Faro proxy call that can only 403).
  const probeCandidateIds = useMemo(
    () =>
      getRecommendations()
        .filter((r) => {
          const plugin = pluginsById.get(r.pluginId);
          return !!plugin?.enabled && contextSrv.hasPermissionInMetadata(AccessControlAction.PluginsAppAccess, plugin);
        })
        .map((r) => r.pluginId),
    [pluginsById]
  );

  // One entry per probed plugin, landing as each probe settles, so a slow probe never suppresses
  // an already-settled setup card. hasSolutionData never rejects.
  const [probeResults, setProbeResults] = useState<Record<string, boolean>>({});
  useEffect(() => {
    let cancelled = false;
    setProbeResults({});
    for (const pluginId of probeCandidateIds) {
      hasSolutionData(pluginId).then((hasData) => {
        if (!cancelled) {
          setProbeResults((prev) => ({ ...prev, [pluginId]: hasData }));
        }
      });
    }
    return () => {
      cancelled = true;
    };
  }, [probeCandidateIds]);

  // An unavailable plugin list fails closed. /api/plugins always lists at least the core plugins,
  // so an empty response means the list is unreliable and also fails closed.
  const listReady = !pluginsLoading && !!installedPlugins && installedPlugins.length > 0;

  const recommendations = !listReady
    ? []
    : getRecommendations().flatMap((recommendation): RecommendationItem[] => {
        const plugin = pluginsById.get(recommendation.pluginId);
        if (!plugin) {
          // Unlistable plugins take the install-only path.
          return canInstall ? [toEnableItem(recommendation)] : [];
        }
        if (plugin.enabled) {
          // Setup card only for a probe that settled on "no data" (probed apps are pre-filtered
          // to ones the user can open). A pending or skipped probe excludes just this card for
          // the render; enable cards and the left no-data card mount immediately.
          return probeResults[recommendation.pluginId] === false ? [toSetupItem(recommendation)] : [];
        }
        // plugins:write is scoped to this plugin.
        return contextSrv.hasPermissionInMetadata(AccessControlAction.PluginsWrite, plugin)
          ? [toEnableItem(recommendation)]
          : [];
      });

  const visible = recommendations.length > 0;
  // Settled empty: everything resolved and there is genuinely nothing to show — as opposed
  // to a pending plugin list or pending probes that may still produce cards.
  const allProbesSettled = probeCandidateIds.every((pluginId) => probeResults[pluginId] !== undefined);
  const settledEmpty = listReady
    ? !visible && allProbesSettled
    : !pluginsLoading && (!installedPlugins || installedPlugins.length === 0);

  useEffect(() => {
    if (visible) {
      store.set(WAS_VISIBLE_KEY, 'true');
    } else if (settledEmpty) {
      store.set(WAS_VISIBLE_KEY, 'false');
    }
  }, [visible, settledEmpty]);

  if (visible) {
    return <RecommendationsView recommendations={recommendations} />;
  }

  // Hold the section's space while loading, but only for users it rendered for last time.
  if (!settledEmpty && store.getBool(WAS_VISIBLE_KEY, false)) {
    return <RecommendationsSkeleton />;
  }

  return null;
}
