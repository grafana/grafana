import { css } from '@emotion/css';
import { formatDistanceToNowStrict } from 'date-fns/formatDistanceToNowStrict';
import { escapeRegExp } from 'lodash';
import { useMemo, useState } from 'react';
import Skeleton from 'react-loading-skeleton';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Alert, Badge, Box, Button, LinkButton, Stack, Text, TextLink, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { alertmanagerApi } from 'app/features/alerting/unified/api/alertmanagerApi';
import { canonicalSeverity, SEVERITY_DEFINITIONS } from 'app/features/alerting/unified/triage/scene/filters/severity';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/constants';
import { type AlertmanagerAlert } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types/accessControl';

import { useUserTeams } from './useUserTeams';

const MAX_ALERTS = 5;

/** Extract pathname from an absolute generatorURL, falling back to the raw value. */
function alertDetailHref(alert: AlertmanagerAlert) {
  const raw = alert.generatorURL;
  if (!raw) {
    return undefined;
  }
  try {
    return new URL(raw).pathname;
  } catch {
    return raw;
  }
}

function severityRank(alert: AlertmanagerAlert) {
  const level = canonicalSeverity(alert.labels.severity);
  return level ? SEVERITY_DEFINITIONS.findIndex((d) => d.level === level) : -1;
}

function buildTeamMatchers(teamNames: string[]) {
  if (teamNames.length === 0) {
    return [];
  }
  return [{ name: 'team', value: teamNames.map(escapeRegExp).join('|'), isRegex: true, isEqual: true }];
}

export function FiringAlertsCard() {
  if (!contextSrv.hasPermission(AccessControlAction.AlertingInstanceRead)) {
    return null;
  }

  return <FiringAlertsCardInner />;
}

/**
 * Inner component avoids calling hooks conditionally —
 * the permission gate is in the parent wrapper.
 */
function FiringAlertsCardInner() {
  const styles = useStyles2(getStyles);
  const [showAllAlerts, setShowAllAlerts] = useState(false);

  const { value: teams, loading: teamsLoading } = useUserTeams();

  const teamNames = useMemo(() => (teams ?? []).map((t) => t.name), [teams]);
  const hasTeams = teamNames.length > 0;

  // When showAllAlerts is toggled, drop the team matchers
  const matchers = useMemo(
    () => (hasTeams && !showAllAlerts ? buildTeamMatchers(teamNames) : []),
    [hasTeams, showAllAlerts, teamNames]
  );

  const {
    data: alerts,
    isLoading: alertsLoading,
    error: alertsError,
    refetch,
  } = alertmanagerApi.useGetAlertmanagerAlertsQuery(
    {
      amSourceName: GRAFANA_RULES_SOURCE_NAME,
      filter: { active: true, silenced: false, inhibited: false, matchers },
      showErrorAlert: false,
    },
    { skip: teamsLoading }
  );

  const loading = teamsLoading || alertsLoading;

  const sorted = useMemo(() => {
    if (!alerts) {
      return [];
    }
    return [...alerts].sort((a, b) => {
      const s = severityRank(b) - severityRank(a);
      if (s !== 0) {
        return s;
      }
      // Most recent first within the same severity
      return new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime();
    });
  }, [alerts]);

  const displayed = sorted.slice(0, MAX_ALERTS);

  const criticalCount = alerts?.filter((a) => canonicalSeverity(a.labels.severity) === 'critical').length ?? 0;
  const highCount = alerts?.filter((a) => canonicalSeverity(a.labels.severity) === 'major').length ?? 0;

  const viewAllHref = `/alerting/groups?dataSource=${GRAFANA_RULES_SOURCE_NAME}`;

  return (
    <Box backgroundColor="canvas" borderRadius="default" padding={3} flex={1} minWidth="320px">
      <Stack direction="column" gap={2}>
        {/* Header */}
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" gap={1}>
            <Text variant="h5">
              <Trans i18nKey="home.firing-alerts-card.title">Firing alerts</Trans>
            </Text>
            {!loading && alerts && alerts.length > 0 && <Badge text={String(alerts.length)} color="red" />}
          </Stack>
          {!loading && (
            <Stack direction="row" gap={1}>
              {criticalCount > 0 && (
                <Badge
                  text={t('home.firing-alerts-card.critical-count', '', {
                    count: criticalCount,
                    defaultValue_one: '{{count}} critical',
                    defaultValue_other: '{{count}} critical',
                  })}
                  color="red"
                />
              )}
              {highCount > 0 && (
                <Badge
                  text={t('home.firing-alerts-card.high-count', '', {
                    count: highCount,
                    defaultValue_one: '{{count}} high',
                    defaultValue_other: '{{count}} high',
                  })}
                  color="orange"
                />
              )}
            </Stack>
          )}
        </Stack>

        {/* Body */}
        {loading && (
          <Stack direction="column" gap={1}>
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} height={20} />
            ))}
          </Stack>
        )}

        {!!alertsError && (
          <Alert
            severity="warning"
            title={t('home.firing-alerts-card.error-title', 'Could not load firing alerts')}
            action={
              <Button onClick={() => refetch()} variant="secondary" size="sm">
                <Trans i18nKey="home.firing-alerts-card.retry">Retry</Trans>
              </Button>
            }
          />
        )}

        {!loading && !alertsError && displayed.length === 0 && (
          <Stack direction="column" gap={1} alignItems="center">
            <Text color="secondary">
              {hasTeams && !showAllAlerts
                ? t('home.firing-alerts-card.empty-teams', 'No firing alerts for your teams.')
                : t('home.firing-alerts-card.empty', 'You have no firing alerts.')}
            </Text>
            {hasTeams && !showAllAlerts && (
              <Button variant="secondary" size="sm" fill="text" onClick={() => setShowAllAlerts(true)}>
                <Trans i18nKey="home.firing-alerts-card.show-all">Show all firing alerts</Trans>
              </Button>
            )}
          </Stack>
        )}

        {!loading && !alertsError && displayed.length > 0 && (
          <ul className={styles.list}>
            {displayed.map((alert) => {
              const detailHref = alertDetailHref(alert);
              return (
                <li key={alert.fingerprint} className={styles.row}>
                  <span className={styles.severityDot} data-severity={alert.labels.severity} />
                  {detailHref ? (
                    <TextLink href={detailHref} inline={false} className={styles.alertName}>
                      {alert.labels.alertname}
                    </TextLink>
                  ) : (
                    <Text truncate weight="medium">
                      {alert.labels.alertname}
                    </Text>
                  )}
                  {alert.labels.team && (
                    <Text color="secondary" variant="bodySmall" truncate>
                      {alert.labels.team}
                    </Text>
                  )}
                  <span className={styles.age}>
                    <Text color="secondary" variant="bodySmall">
                      {formatDistanceToNowStrict(new Date(alert.startsAt), { addSuffix: true })}
                    </Text>
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {/* Footer */}
        {!loading && !alertsError && (
          <Stack direction="row" justifyContent="flex-end">
            <LinkButton variant="secondary" size="sm" fill="text" href={viewAllHref}>
              <Trans i18nKey="home.firing-alerts-card.view-all">View all firing alerts</Trans>
            </LinkButton>
          </Stack>
        )}
      </Stack>
    </Box>
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
  severityDot: css({
    flexShrink: 0,
    width: 8,
    height: 8,
    borderRadius: theme.shape.radius.circle,
    backgroundColor: theme.colors.text.secondary,

    '&[data-severity="critical"]': {
      backgroundColor: theme.colors.error.main,
    },
    '&[data-severity="high"]': {
      backgroundColor: theme.colors.warning.main,
    },
    '&[data-severity="warning"]': {
      backgroundColor: theme.colors.warning.text,
    },
  }),
  alertName: css({
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  age: css({
    marginLeft: 'auto',
    flexShrink: 0,
  }),
});
