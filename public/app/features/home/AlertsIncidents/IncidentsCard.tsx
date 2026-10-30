import { t, Trans } from '@grafana/i18n';
import { LinkButton, Tooltip } from '@grafana/ui';
import { createBridgeURL } from 'app/features/alerting/unified/components/PluginBridge';
import { SeverityBars } from 'app/features/alerting/unified/triage/scene/filters/SeverityBars';
import { canonicalSeverity } from 'app/features/alerting/unified/triage/scene/filters/severity';
import { ListRow } from 'app/plugins/panel/dashlist/ListRow';

import { TimeAgoCell } from '../TimeAgoCell';
import { ctaClicked } from '../analytics/main';

import { AllClearGrot, SummaryCard } from './SummaryCard';
import { type FilterScope } from './filterSelection';
import { type IncidentsData } from './useIncidents';

/** Empty-state copy names the filtered value; the unfiltered scope uses the generic line. */
function emptyMessage(filterScope: FilterScope): string {
  if (filterScope.kind === 'label') {
    // Value only: the dropdown headers show field names, and the selection only holds the slug.
    // Key and param predate the widening past `team`; the copy fits any field value, so they stay.
    return t('home.incidents-card.empty-selected-team', 'All quiet! No active incidents for {{team}}.', {
      team: filterScope.label.value,
      interpolation: { escapeValue: false },
    });
  }
  return t('home.incidents-card.empty', 'All quiet! No active incidents.');
}

/** Render-only card body; data comes from useIncidents so callers control where the hook runs. */
export function IncidentsCard({ data }: { data: IncidentsData }) {
  const { pluginId, canAccess, canDeclare, displayed, filterScope, loading, error, refetch } = data;

  return (
    <SummaryCard
      loading={loading}
      error={
        error
          ? { title: t('home.incidents-card.error-title', 'Could not load active incidents'), onRetry: () => refetch() }
          : undefined
      }
      emptyMessage={emptyMessage(filterScope)}
      emptyImage={<AllClearGrot />}
      items={displayed}
      getItemKey={(incident) => incident.incidentID}
      renderItem={(incident) => (
        <ListRow
          prefix={
            // Same severity treatment as the firing-alerts rows so the two tabs share one visual language
            <Tooltip content={incident.severityLabel}>
              <span>
                <SeverityBars level={canonicalSeverity(incident.severityLabel)} />
                <span className="sr-only">{incident.severityLabel}</span>
              </span>
            </Tooltip>
          }
          title={incident.title}
          trailing={<TimeAgoCell date={new Date(incident.createdTime)} />}
          href={canAccess ? createBridgeURL(pluginId, `/incidents/${incident.incidentID}`) : undefined}
          onClick={() => ctaClicked({ surface: 'incidents_card', action: 'incident_detail', placement: 'list' })}
        />
      )}
      emptyAction={
        canDeclare ? (
          <LinkButton
            variant="primary"
            size="sm"
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
    />
  );
}
