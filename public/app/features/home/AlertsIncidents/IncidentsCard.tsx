import { t, Trans } from '@grafana/i18n';
import { useFlagGrafanaGrowthHomepage } from '@grafana/runtime/internal';
import { Badge, LinkButton } from '@grafana/ui';
import { ACTIVE_INCIDENTS_QUERY_LIMIT } from 'app/features/alerting/unified/api/incidentsApi';
import { createBridgeURL } from 'app/features/alerting/unified/components/PluginBridge';
import { useIrmPlugin } from 'app/features/alerting/unified/hooks/usePluginBridge';
import { canonicalSeverity } from 'app/features/alerting/unified/triage/scene/filters/severity';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';
import { ListRow } from 'app/plugins/panel/dashlist/ListRow';

import { incidentsCardClicked } from '../analytics/main';

import { DeclareAndViewIncidentsButtons } from './DeclareAndViewIncidentsButtons';
import { SummaryCard, SummaryCardAge } from './SummaryCard';
import { severityLevelColor } from './severity';
import { useIncidents, type IncidentsData } from './useIncidents';

export function IncidentsCard() {
  const { installed, loading } = useIrmPlugin(SupportedPlugin.Incident);

  // Hide the card whenever the Incident/IRM plugin isn't available — including while the
  // settings probe is in flight, so the card never flashes in before disappearing.
  if (loading || !installed) {
    return null;
  }

  return <IncidentsCardInner />;
}

/**
 * Inner component avoids calling hooks conditionally —
 * the availability gate lives in the parent wrapper.
 */
function IncidentsCardInner() {
  const data = useIncidents();
  return <IncidentsCardView data={data} />;
}

/** Render-only card body; data comes from useIncidents so callers control where the hook runs. */
export function IncidentsCardView({
  data,
  hideFooterActions = false,
}: {
  data: IncidentsData;
  hideFooterActions?: boolean;
}) {
  const redesignEnabled = useFlagGrafanaGrowthHomepage();
  const { pluginId, canAccess, canDeclare, displayed, count, hasMore, loading, error, refetch } = data;

  return (
    <SummaryCard
      title={t('home.incidents-card.title', 'Active incidents')}
      count={count}
      // Only cap the badge when the server actually truncated the result; a full page with
      // nothing beyond it should read the exact count, not "{limit}+".
      countLimit={hasMore ? ACTIVE_INCIDENTS_QUERY_LIMIT : undefined}
      loading={loading}
      error={
        error
          ? { title: t('home.incidents-card.error-title', 'Could not load active incidents'), onRetry: () => refetch() }
          : undefined
      }
      emptyMessage={t('home.incidents-card.empty', 'No active incidents.')}
      items={displayed}
      getItemKey={(incident) => incident.incidentID}
      renderItem={(incident) => (
        <ListRow
          prefix={
            <Badge
              text={incident.severityLabel}
              color={severityLevelColor(canonicalSeverity(incident.severityLabel))}
            />
          }
          title={incident.title}
          trailing={<SummaryCardAge date={new Date(incident.createdTime)} />}
          href={canAccess ? createBridgeURL(pluginId, `/incidents/${incident.incidentID}`) : undefined}
          onClick={() =>
            incidentsCardClicked({
              action: 'incident_detail',
              placement: 'list',
              severity: canonicalSeverity(incident.severityLabel),
            })
          }
          showDivider={redesignEnabled}
        />
      )}
      emptyAction={
        canDeclare ? (
          <LinkButton
            variant="primary"
            icon="fire"
            href={createBridgeURL(pluginId, '/incidents', { declare: 'new' })}
            onClick={() => incidentsCardClicked({ action: 'declare_incident', placement: 'empty_state' })}
          >
            <Trans i18nKey="home.incidents-card.declare">Declare an incident</Trans>
          </LinkButton>
        ) : undefined
      }
      footer={
        !hideFooterActions && (
          <DeclareAndViewIncidentsButtons
            pluginId={pluginId}
            count={count}
            canDeclare={canDeclare}
            canAccess={canAccess}
          />
        )
      }
    />
  );
}
