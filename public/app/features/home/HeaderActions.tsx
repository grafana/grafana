import { css } from '@emotion/css';
import { type RefObject } from 'react';

import { locale, type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Button, ButtonGroup, Icon, Stack, Text, useStyles2 } from '@grafana/ui';
import { SeverityBars } from 'app/features/alerting/unified/triage/scene/filters/SeverityBars';

import { ALERTS_TAB_ID, INCIDENTS_TAB_ID, type AlertIncidentSwitchHandle } from './AlertsIncidents/AlertIncidentTabs';
import { type FiringAlertsData } from './AlertsIncidents/useFiringAlerts';
import { type IncidentsData } from './AlertsIncidents/useIncidents';
import { ctaClicked } from './analytics/main';

export function HeaderActions({
  alertsData,
  incidentsData,
  alertIncidentRef,
}: {
  alertsData: FiringAlertsData;
  incidentsData: IncidentsData;
  alertIncidentRef: RefObject<AlertIncidentSwitchHandle | null>;
}) {
  const styles = useStyles2(getStyles);

  const canViewIncidents = !!incidentsData.enabled;
  const canViewAlerts = alertsData.enabled;

  // Hide the overview if neither alerts nor incidents are available
  if (!canViewAlerts && !canViewIncidents) {
    return null;
  }

  return (
    <ButtonGroup className={styles.group}>
      {canViewAlerts && !alertsData.error && (
        <Button
          variant="secondary"
          tooltip={t('home.header-actions.firing-alerts', 'Firing alerts')}
          aria-label={t('home.header-actions.firing-alerts', 'Firing alerts')}
          icon="bell"
          onClick={() => {
            if (alertIncidentRef.current) {
              alertIncidentRef.current.switch(ALERTS_TAB_ID);
              ctaClicked({
                surface: 'header',
                action: 'view_alerts',
                placement: 'pill',
              });
            }
          }}
        >
          <Stack direction="row" alignItems="center" gap={1}>
            {alertsData.loading ? (
              <Icon name="spinner" />
            ) : alertsData.count === 0 ? (
              <Text variant="bodySmall" color="secondary">
                <Trans i18nKey="home.header-actions.no-firing-alerts">All clear</Trans>
              </Text>
            ) : (
              <>
                <Text>{locale(alertsData.count, 0).text}</Text>

                {alertsData.criticalCount > 0 && (
                  <Stack direction="row" alignItems="center" gap={0.5}>
                    <SeverityBars level="critical" />
                    <Text variant="bodySmall" color="secondary">
                      {locale(alertsData.criticalCount, 0).text}
                    </Text>
                  </Stack>
                )}

                {alertsData.highCount > 0 && (
                  <Stack direction="row" alignItems="center" gap={0.5}>
                    <SeverityBars level="major" />
                    <Text variant="bodySmall" color="secondary">
                      {locale(alertsData.highCount, 0).text}
                    </Text>
                  </Stack>
                )}
              </>
            )}
          </Stack>
        </Button>
      )}

      {canViewIncidents && !incidentsData.error && (
        <Button
          variant="secondary"
          tooltip={t('home.header-actions.active-incidents', 'Active incidents')}
          aria-label={t('home.header-actions.active-incidents', 'Active incidents')}
          icon="fire"
          onClick={() => {
            if (alertIncidentRef.current) {
              alertIncidentRef.current.switch(INCIDENTS_TAB_ID);
              ctaClicked({
                surface: 'header',
                action: 'view_incidents',
                placement: 'pill',
              });
            }
          }}
        >
          <Stack direction="row" alignItems="center" gap={1}>
            {incidentsData.loading ? (
              <Icon name="spinner" />
            ) : incidentsData.count === 0 ? (
              <Text variant="bodySmall" color="secondary">
                <Trans i18nKey="home.header-actions.no-active-incidents">All clear</Trans>
              </Text>
            ) : (
              <Text>
                {incidentsData.hasMore
                  ? `${locale(incidentsData.count, 0).text}+`
                  : locale(incidentsData.count, 0).text}
              </Text>
            )}
          </Stack>
        </Button>
      )}
    </ButtonGroup>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  group: css({
    marginTop: 'auto',
  }),
});
