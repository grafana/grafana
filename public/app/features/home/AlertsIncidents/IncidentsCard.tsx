import { useMemo } from 'react';

import { t, Trans } from '@grafana/i18n';
import { isFetchError } from '@grafana/runtime';
import { Badge, type BadgeColor, LinkButton } from '@grafana/ui';
import { ACTIVE_INCIDENTS_QUERY_LIMIT, incidentsApi } from 'app/features/alerting/unified/api/incidentsApi';
import { createBridgeURL } from 'app/features/alerting/unified/components/PluginBridge';
import { canAccessPluginPage, useIrmPlugin } from 'app/features/alerting/unified/hooks/usePluginBridge';
import { canonicalSeverity } from 'app/features/alerting/unified/triage/scene/filters/severity';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';

import { SummaryCard, SummaryCardAge, SummaryCardTitle } from './SummaryCard';
import { HOME_CARD_MAX_ITEMS } from './constants';

// Incident severity labels are org-configurable; canonicalSeverity normalizes the well-known aliases
// (e.g. "high" → major, "SEV1" → critical) the same way the firing-alerts card does. Unknown labels stay neutral.
function severityColor(severityLabel: string): BadgeColor {
  switch (canonicalSeverity(severityLabel)) {
    case 'critical':
      return 'red';
    case 'major':
      return 'orange';
    default:
      return 'darkgrey';
  }
}

export function IncidentsCard() {
  const { pluginId, installed, loading, settings } = useIrmPlugin(SupportedPlugin.Incident);

  // Hide the card whenever the Incident/IRM plugin isn't available — including while the
  // settings probe is in flight, so the card never flashes in before disappearing.
  if (loading || !installed) {
    return null;
  }

  // Gate incident links like DeclareIncidentButton/InstanceDetailsDrawerTitle do: a user without
  // access to the plugin's incidents page sees titles as plain text, not links that 403 on click.
  const canAccess = settings ? canAccessPluginPage(settings, createBridgeURL(pluginId, '/incidents')) : false;

  return <IncidentsCardInner pluginId={pluginId} canAccess={canAccess} />;
}

/**
 * Inner component avoids calling hooks conditionally —
 * the availability gate lives in the parent wrapper.
 */
function IncidentsCardInner({ pluginId, canAccess }: { pluginId: string; canAccess: boolean }) {
  const { data: incidents, isLoading, error, refetch } = incidentsApi.useGetActiveIncidentsQuery({ pluginId });

  // A 404 from the Incident backend means this org has no incident record yet (plugin installed but not
  // onboarded, or no incident ever created) — that's "no active incidents", not a failure. Every other
  // error (401/403/5xx/network) is genuine and surfaced to the user.
  const loadError = !!error && !(isFetchError(error) && error.status === 404);

  // Most recent first, then capped client-side so the card never relies on server ordering.
  const displayed = useMemo(
    () =>
      [...(incidents ?? [])]
        .sort((a, b) => new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime())
        .slice(0, HOME_CARD_MAX_ITEMS),
    [incidents]
  );

  return (
    <SummaryCard
      title={t('home.incidents-card.title', 'Active incidents')}
      count={incidents?.length ?? 0}
      countLimit={ACTIVE_INCIDENTS_QUERY_LIMIT}
      loading={isLoading}
      error={
        loadError
          ? { title: t('home.incidents-card.error-title', 'Could not load active incidents'), onRetry: () => refetch() }
          : undefined
      }
      emptyMessage={t('home.incidents-card.empty', 'No active incidents.')}
      items={displayed}
      getItemKey={(incident) => incident.incidentID}
      renderItem={(incident) => (
        <>
          <Badge text={incident.severityLabel} color={severityColor(incident.severityLabel)} />
          <SummaryCardTitle
            href={canAccess ? createBridgeURL(pluginId, `/incidents/${incident.incidentID}`) : undefined}
          >
            {incident.title}
          </SummaryCardTitle>
          <SummaryCardAge date={new Date(incident.createdTime)} />
        </>
      )}
      footer={
        canAccess ? (
          <LinkButton variant="secondary" size="sm" fill="text" href={createBridgeURL(pluginId, '/incidents')}>
            <Trans i18nKey="home.incidents-card.view-all">View all incidents</Trans>
          </LinkButton>
        ) : undefined
      }
    />
  );
}
