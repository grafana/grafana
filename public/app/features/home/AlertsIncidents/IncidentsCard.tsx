import { css } from '@emotion/css';
import { formatDistanceToNowStrict } from 'date-fns/formatDistanceToNowStrict';
import { useMemo } from 'react';
import Skeleton from 'react-loading-skeleton';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { isFetchError } from '@grafana/runtime';
import { Alert, Badge, type BadgeColor, Button, LinkButton, Stack, Text, TextLink, useStyles2 } from '@grafana/ui';
import { incidentsApi } from 'app/features/alerting/unified/api/incidentsApi';
import { createBridgeURL } from 'app/features/alerting/unified/components/PluginBridge';
import { useIrmPlugin } from 'app/features/alerting/unified/hooks/usePluginBridge';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';

import { HomeSection } from '../HomeSection';

const MAX_INCIDENTS = 5;

// Incident severity labels are org-configurable, so only the well-known levels get a color and everything else stays neutral.
function severityColor(severityLabel: string): BadgeColor {
  switch (severityLabel.toLowerCase()) {
    case 'critical':
      return 'red';
    case 'major':
      return 'orange';
    default:
      return 'darkgrey';
  }
}

export function IncidentsCard() {
  const { pluginId, installed, loading } = useIrmPlugin(SupportedPlugin.Incident);

  // Hide the card whenever the Incident/IRM plugin isn't available — including while the
  // settings probe is in flight, so the card never flashes in before disappearing.
  if (loading || !installed) {
    return null;
  }

  return <IncidentsCardInner pluginId={pluginId} />;
}

/**
 * Inner component avoids calling hooks conditionally —
 * the availability gate lives in the parent wrapper.
 */
function IncidentsCardInner({ pluginId }: { pluginId: string }) {
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
          {!isLoading && !!incidents?.length && <Badge text={String(incidents.length)} color="red" />}
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
                <TextLink
                  href={createBridgeURL(pluginId, `/incidents/${incident.incidentID}`)}
                  inline={false}
                  className={styles.incidentTitle}
                >
                  {incident.title}
                </TextLink>
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
        {!isLoading && !loadError && (
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
