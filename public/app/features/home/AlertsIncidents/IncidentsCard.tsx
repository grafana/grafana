import { css } from '@emotion/css';
import { formatDistanceToNowStrict } from 'date-fns/formatDistanceToNowStrict';
import { useMemo } from 'react';
import Skeleton from 'react-loading-skeleton';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { isFetchError } from '@grafana/runtime';
import { Alert, Badge, type BadgeColor, Button, LinkButton, Stack, Text, TextLink, useStyles2 } from '@grafana/ui';
import { ACTIVE_INCIDENTS_QUERY_LIMIT, incidentsApi } from 'app/features/alerting/unified/api/incidentsApi';
import { createBridgeURL } from 'app/features/alerting/unified/components/PluginBridge';
import { canAccessPluginPage, useIrmPlugin } from 'app/features/alerting/unified/hooks/usePluginBridge';
import { canonicalSeverity } from 'app/features/alerting/unified/triage/scene/filters/severity';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';

import { HomeSection } from '../HomeSection';

import { CARD_LIST_MAX_HEIGHT } from './constants';

const MAX_INCIDENTS = 5;

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
  const styles = useStyles2(getStyles);

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
        .slice(0, MAX_INCIDENTS),
    [incidents]
  );

  return (
    <HomeSection>
      <Stack direction="column" gap={2}>
        {/* Header */}
        <Stack direction="row" alignItems="center" gap={1}>
          <Text element="h2" variant="h5">
            <Trans i18nKey="home.incidents-card.title">Active incidents</Trans>
          </Text>
          {!isLoading && !!incidents?.length && (
            <Badge
              text={
                incidents.length >= ACTIVE_INCIDENTS_QUERY_LIMIT
                  ? `${ACTIVE_INCIDENTS_QUERY_LIMIT}+`
                  : String(incidents.length)
              }
              color="red"
            />
          )}
        </Stack>

        {isLoading && (
          <Stack direction="column" gap={1}>
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} height={20} />
            ))}
          </Stack>
        )}

        {loadError && (
          <Alert
            severity="warning"
            title={t('home.incidents-card.error-title', 'Could not load active incidents')}
            action={
              <Button onClick={() => refetch()} variant="secondary" size="sm">
                <Trans i18nKey="home.incidents-card.retry">Retry</Trans>
              </Button>
            }
          />
        )}

        {!isLoading && !loadError && displayed.length === 0 && (
          <Stack direction="column" alignItems="center">
            <Text color="secondary">
              <Trans i18nKey="home.incidents-card.empty">No active incidents.</Trans>
            </Text>
          </Stack>
        )}

        {!isLoading && !loadError && displayed.length > 0 && (
          <ul className={styles.list}>
            {displayed.map((incident) => (
              <li key={incident.incidentID} className={styles.row}>
                <Badge text={incident.severityLabel} color={severityColor(incident.severityLabel)} />
                {canAccess ? (
                  <TextLink
                    href={createBridgeURL(pluginId, `/incidents/${incident.incidentID}`)}
                    inline={false}
                    className={styles.incidentTitle}
                  >
                    {incident.title}
                  </TextLink>
                ) : (
                  <Text truncate>{incident.title}</Text>
                )}
                <span className={styles.age}>
                  <Text color="secondary" variant="bodySmall">
                    {formatDistanceToNowStrict(new Date(incident.createdTime), { addSuffix: true })}
                  </Text>
                </span>
              </li>
            ))}
          </ul>
        )}

        {/* Footer */}
        {!isLoading && !loadError && canAccess && (
          <Stack direction="row" justifyContent="flex-end">
            <LinkButton variant="secondary" size="sm" fill="text" href={createBridgeURL(pluginId, '/incidents')}>
              <Trans i18nKey="home.incidents-card.view-all">View all incidents</Trans>
            </LinkButton>
          </Stack>
        )}
      </Stack>
    </HomeSection>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  list: css({
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
    // Match the firing-alerts card's max height so the two cards line up; scroll if ever exceeded.
    maxHeight: CARD_LIST_MAX_HEIGHT,
    overflowY: 'auto',
  }),
  row: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(0.5, 0),
    minWidth: 0,
  }),
  incidentTitle: css({
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  age: css({
    marginLeft: 'auto',
    flexShrink: 0,
  }),
});
