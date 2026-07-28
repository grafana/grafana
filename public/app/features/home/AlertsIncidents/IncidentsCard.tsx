import { t, Trans } from '@grafana/i18n';
import { useFlagGrafanaGrowthHomepage } from '@grafana/runtime/internal';
import { Badge, LinkButton, Tooltip } from '@grafana/ui';
import { ACTIVE_INCIDENTS_QUERY_LIMIT } from 'app/features/alerting/unified/api/incidentsApi';
import { createBridgeURL } from 'app/features/alerting/unified/components/PluginBridge';
import { SeverityBars } from 'app/features/alerting/unified/triage/scene/filters/SeverityBars';
import { canonicalSeverity } from 'app/features/alerting/unified/triage/scene/filters/severity';
import { ListRow } from 'app/plugins/panel/dashlist/ListRow';

import { ctaClicked } from '../analytics/main';

import { DeclareAndViewIncidentsButtons } from './DeclareAndViewIncidentsButtons';
import { SummaryCard, SummaryCardAge, SummaryCardPrefix } from './SummaryCard';
import { severityLevelColor } from './severity';
import { useIncidents, type IncidentsData } from './useIncidents';

export function IncidentsCard() {
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
            redesignEnabled ? (
              // Same severity treatment as the firing-alerts rows so the two tabs share one visual language
              <Tooltip content={incident.severityLabel}>
                <span>
                  <SeverityBars level={canonicalSeverity(incident.severityLabel)} />
                  <span className="sr-only">{incident.severityLabel}</span>
                </span>
              </Tooltip>
            ) : (
              <SummaryCardPrefix>
                <Badge
                  text={incident.severityLabel}
                  color={severityLevelColor(canonicalSeverity(incident.severityLabel))}
                />
              </SummaryCardPrefix>
            )
          }
          title={incident.title}
          trailing={<SummaryCardAge date={new Date(incident.createdTime)} />}
          href={canAccess ? createBridgeURL(pluginId, `/incidents/${incident.incidentID}`) : undefined}
          onClick={() => ctaClicked({ surface: 'incidents_card', action: 'incident_detail', placement: 'list' })}
          showDivider={redesignEnabled}
        />
      )}
      emptyAction={
        canDeclare ? (
          <LinkButton
            variant="primary"
            icon="fire"
            href={createBridgeURL(pluginId, '/incidents', { declare: 'new' })}
            onClick={() =>
              ctaClicked({ surface: 'incidents_card', action: 'declare_incident', placement: 'empty_state' })
            }
          >
            <Trans i18nKey="home.incidents-card.declare">Declare an incident</Trans>
          </LinkButton>
        ) : undefined
      }
      footer={
        !hideFooterActions && (
          <DeclareAndViewIncidentsButtons
            pluginId={pluginId}
            hasIncidents={count > 0}
            canDeclare={canDeclare}
            canAccess={canAccess}
          />
        )
      }
    />
  );
}
