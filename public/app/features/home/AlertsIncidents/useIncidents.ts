import { skipToken } from '@reduxjs/toolkit/query';
import { useMemo } from 'react';

import { isFetchError } from '@grafana/runtime';
import { incidentsApi } from 'app/features/alerting/unified/api/incidentsApi';
import { createBridgeURL } from 'app/features/alerting/unified/components/PluginBridge';
import { canAccessPluginPage, usePluginBridge } from 'app/features/alerting/unified/hooks/usePluginBridge';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';

import { HOME_CARD_MAX_ITEMS } from './constants';
import { type TeamSelection, explicitTeam } from './teamFilter';

export type IncidentsData = ReturnType<typeof useIncidents>;

/**
 * All data fetching and derived state for the homepage Active incidents view,
 * shared between the old-layout card and the redesigned tabs.
 *
 * When `selectedTeam` is an explicit team pick, incidents are filtered to that
 * team's custom field value; the default scope fetches every active incident.
 */
export function useIncidents(selectedTeam: TeamSelection = '') {
  const { installed, loading: pluginLoading, settings } = usePluginBridge(SupportedPlugin.Irm);
  const pluginId = SupportedPlugin.Irm;

  // Gate incident links like DeclareIncidentButton/InstanceDetailsDrawerTitle do: a user without
  // access to the plugin's incidents page sees titles as plain text, not links that 403 on click.
  const canAccess = settings ? canAccessPluginPage(settings, createBridgeURL(pluginId, '/incidents')) : false;
  // canDeclare gates on the plugin's /incidents/declare write include; the button itself deep-links to
  // /incidents?declare=new (IRM's declare flow), and canAccessPluginPage ignores the query string.
  const canDeclare = settings ? canAccessPluginPage(settings, createBridgeURL(pluginId, '/incidents/declare')) : false;

  const team = explicitTeam(selectedTeam);

  // Skipped until the plugin probe confirms availability, so the hook can run unconditionally
  // in callers that render even when incidents are unavailable.
  const skip = pluginLoading || !installed;
  // currentData is undefined only until the current team's list arrives, so a team switch
  // shows the skeleton while a homepage revisit (refetchOnMountOrArgChange) shows the cached list.
  const { currentData, isFetching, error, refetch } = incidentsApi.useGetActiveIncidentsQuery(
    skip ? skipToken : { pluginId, team },
    {
      refetchOnMountOrArgChange: true,
    }
  );
  const incidents = useMemo(() => currentData?.incidents ?? [], [currentData]);
  // True when the server truncated the result at the query limit, i.e. the real total exceeds count.
  const hasMore = currentData?.hasMore ?? false;

  const loading = pluginLoading || (isFetching && currentData === undefined);
  const count = incidents.length;
  const hasIncidents = count > 0;
  // A 404 from the Incident backend means this org has no incident record yet (plugin installed but not
  // onboarded, or no incident ever created) — that's "no active incidents", not a failure. Every other
  // error (401/403/5xx/network) is genuine and surfaced to the user.
  const loadError = !!error && !(isFetchError(error) && error.status === 404);

  // Most recent incidents first; capped client-side.
  const displayed = useMemo(
    () =>
      [...incidents]
        .sort((a, b) => new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime())
        .slice(0, HOME_CARD_MAX_ITEMS),
    [incidents]
  );

  return {
    pluginId,
    canAccess,
    canDeclare,
    displayed,
    count,
    hasMore,
    hasIncidents,
    // Echoed back so the card can scope its empty message to the filtered team.
    selectedTeam,
    enabled: pluginLoading ? undefined : !!installed,
    loading,
    error: loadError,
    refetch,
  };
}
