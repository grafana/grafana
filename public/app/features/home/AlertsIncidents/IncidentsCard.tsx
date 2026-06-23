import { useMemo } from 'react';

import { t, Trans } from '@grafana/i18n';
import { isFetchError } from '@grafana/runtime';
import { Badge, LinkButton } from '@grafana/ui';
import { ACTIVE_INCIDENTS_QUERY_LIMIT, incidentsApi } from 'app/features/alerting/unified/api/incidentsApi';
import { createBridgeURL } from 'app/features/alerting/unified/components/PluginBridge';
import { canAccessPluginPage, useIrmPlugin } from 'app/features/alerting/unified/hooks/usePluginBridge';
import { canonicalSeverity } from 'app/features/alerting/unified/triage/scene/filters/severity';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';

import { SummaryCard, SummaryCardAge, SummaryCardTitle } from './SummaryCard';
import { HOME_CARD_MAX_ITEMS } from './constants';
import { severityLevelColor, severityLevelRank } from './severity';

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
  // canDeclare gates on the plugin's /incidents/declare write include; the button itself deep-links to
  // /incidents?declare=new (IRM's declare flow), and canAccessPluginPage ignores the query string.
  const canDeclare = settings ? canAccessPluginPage(settings, createBridgeURL(pluginId, '/incidents/declare')) : false;

  return <IncidentsCardInner pluginId={pluginId} canAccess={canAccess} canDeclare={canDeclare} />;
}

type IncidentsCardInnerProps = {
  pluginId: string;
  canAccess: boolean;
  canDeclare: boolean;
};

/**
 * Inner component avoids calling hooks conditionally —
 * the availability gate lives in the parent wrapper.
 */
function IncidentsCardInner({ pluginId, canAccess, canDeclare }: IncidentsCardInnerProps) {
  const { data: incidents = [], isLoading, error, refetch } = incidentsApi.useGetActiveIncidentsQuery({ pluginId });
  const incidentCount = incidents?.length ?? 0;

  // A 404 from the Incident backend means this org has no incident record yet (plugin installed but not
  // onboarded, or no incident ever created) — that's "no active incidents", not a failure. Every other
  // error (401/403/5xx/network) is genuine and surfaced to the user.
  const loadError = !!error && !(isFetchError(error) && error.status === 404);

  // Most severe first, then most recent within a severity; capped client-side. Unmapped org-custom
  // severity labels (canonicalSeverity → undefined) rank lowest, after all known severities.
  const displayed = useMemo(
    () =>
      [...incidents]
        .sort(
          (a, b) =>
            severityLevelRank(canonicalSeverity(b.severityLabel)) -
              severityLevelRank(canonicalSeverity(a.severityLabel)) ||
            new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime()
        )
        .slice(0, HOME_CARD_MAX_ITEMS),
    [incidents]
  );

  return (
    <SummaryCard
      title={t('home.incidents-card.title', 'Active incidents')}
      count={incidentCount}
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
          <Badge text={incident.severityLabel} color={severityLevelColor(canonicalSeverity(incident.severityLabel))} />
          <SummaryCardTitle
            href={canAccess ? createBridgeURL(pluginId, `/incidents/${incident.incidentID}`) : undefined}
          >
            {incident.title}
          </SummaryCardTitle>
          <SummaryCardAge date={new Date(incident.createdTime)} />
        </>
      )}
      footer={
        !incidentCount
          ? canDeclare && (
              <LinkButton
                variant="secondary"
                size="sm"
                fill="text"
                icon="fire"
                href={createBridgeURL(pluginId, '/incidents', { declare: 'new' })}
              >
                <Trans i18nKey="home.incidents-card.declare">Declare an incident</Trans>
              </LinkButton>
            )
          : canAccess && (
              <LinkButton variant="secondary" size="sm" fill="text" href={createBridgeURL(pluginId, '/incidents')}>
                <Trans i18nKey="home.incidents-card.view-all">View all incidents</Trans>
              </LinkButton>
            )
      }
    />
  );
}
