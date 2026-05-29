import { css } from '@emotion/css';
import { formatDistanceToNowStrict } from 'date-fns/formatDistanceToNowStrict';
import { useMemo } from 'react';
import Skeleton from 'react-loading-skeleton';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Badge, Box, LinkButton, Stack, Text, TextLink, useStyles2 } from '@grafana/ui';
import { type ActiveIncident, incidentsApi } from 'app/features/alerting/unified/api/incidentsApi';
import { useIrmPlugin } from 'app/features/alerting/unified/hooks/usePluginBridge';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';

const MAX_INCIDENTS = 5;
const SEVERITY_ORDER: Record<string, number> = { critical: 0, major: 1, minor: 2 };

function severityRank(incident: ActiveIncident): number {
  return SEVERITY_ORDER[incident.severity] ?? 3;
}

export function ActiveIncidentsCard() {
  const { pluginId, loading: pluginLoading, installed } = useIrmPlugin(SupportedPlugin.Incident);

  if (pluginLoading) {
    return <ActiveIncidentsCardSkeleton />;
  }

  if (!installed) {
    return null;
  }

  return <ActiveIncidentsCardInner pluginId={pluginId} />;
}

function ActiveIncidentsCardSkeleton() {
  return (
    <Box backgroundColor="canvas" borderRadius="default" padding={3} flex={1} minWidth="320px">
      <Stack direction="column" gap={2}>
        <Skeleton height={24} width={180} />
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} height={20} />
        ))}
      </Stack>
    </Box>
  );
}

function ActiveIncidentsCardInner({ pluginId }: { pluginId: string }) {
  const styles = useStyles2(getStyles);

  const { data, isLoading, error } = incidentsApi.useGetActiveIncidentsQuery(
    { pluginId, limit: MAX_INCIDENTS },
    { skip: false }
  );

  const sorted = useMemo(() => {
    if (!data?.incidents) {
      return [];
    }
    return [...data.incidents].sort((a, b) => {
      const s = severityRank(a) - severityRank(b);
      if (s !== 0) {
        return s;
      }
      return new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime();
    });
  }, [data]);

  // On error, render nothing — the plugin proxy may fail for permission reasons
  if (error) {
    console.error('Failed to load active incidents', error);
    return null;
  }

  const incidentsUrl = `/a/${pluginId}/incidents`;

  return (
    <Box backgroundColor="canvas" borderRadius="default" padding={3} flex={1} minWidth="320px">
      <Stack direction="column" gap={2}>
        {/* Header */}
        <Stack direction="row" alignItems="center" gap={1}>
          <Text variant="h5">
            <Trans i18nKey="home.active-incidents-card.title">Active incidents</Trans>
          </Text>
          {!isLoading && sorted.length > 0 && <Badge text={String(sorted.length)} color="red" />}
        </Stack>

        {/* Body */}
        {isLoading && (
          <Stack direction="column" gap={1}>
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} height={20} />
            ))}
          </Stack>
        )}

        {!isLoading && sorted.length === 0 && (
          <Text color="secondary">{t('home.active-incidents-card.empty', 'No active incidents.')}</Text>
        )}

        {!isLoading && sorted.length > 0 && (
          <ul className={styles.list}>
            {sorted.map((incident) => (
              <li key={incident.incidentID} className={styles.row}>
                <Badge text={incident.severity || 'unknown'} color={severityBadgeColor(incident.severity)} />
                <TextLink
                  href={`/a/${pluginId}/incidents/${incident.incidentID}`}
                  inline={false}
                  className={styles.title}
                >
                  {incident.title}
                </TextLink>
                {incident.createdByUser?.name && (
                  <Text color="secondary" variant="bodySmall" truncate>
                    {incident.createdByUser.name}
                  </Text>
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
        {!isLoading && (
          <Stack direction="row" justifyContent="flex-end">
            <LinkButton variant="secondary" size="sm" fill="text" href={incidentsUrl}>
              <Trans i18nKey="home.active-incidents-card.view-all">View all incidents</Trans>
            </LinkButton>
          </Stack>
        )}
      </Stack>
    </Box>
  );
}

function severityBadgeColor(severity: string): 'red' | 'orange' | 'blue' {
  switch (severity) {
    case 'critical':
      return 'red';
    case 'major':
      return 'orange';
    default:
      return 'blue';
  }
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
  title: css({
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  age: css({
    marginLeft: 'auto',
    flexShrink: 0,
  }),
});
