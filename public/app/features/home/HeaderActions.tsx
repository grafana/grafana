import { css } from '@emotion/css';
import { type RefObject } from 'react';

import { type GrafanaTheme2, locale } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Button, ButtonGroup, Stack, Text, useStyles2 } from '@grafana/ui';
import { SeverityBars } from 'app/features/alerting/unified/triage/scene/filters/SeverityBars';

import { ALERTS_TAB_ID, INCIDENTS_TAB_ID, type AlertIncidentSwitchHandle } from './AlertsIncidents/AlertIncidentTabs';
import { type FiringAlertsData } from './AlertsIncidents/useFiringAlerts';
import { type IncidentsData } from './AlertsIncidents/useIncidents';

export function HeaderActions({
  alertsData,
  incidentsData,
  alertIncidentRef,
}: {
  alertsData: FiringAlertsData;
  incidentsData: IncidentsData;
  alertIncidentRef: RefObject<AlertIncidentSwitchHandle>;
}) {
  const styles = useStyles2(getStyles);

  const canViewIncidents = !!incidentsData.enabled && !incidentsData.loading;
  const canViewAlerts = alertsData.enabled;

  // Hide the overview if neither alerts nor incidents are available
  if (!canViewAlerts && !canViewIncidents) {
    return null;
  }

  return (
    <ButtonGroup className={styles.group}>
      {canViewAlerts && (
        <Button
          variant="secondary"
          tooltip={t('home.header-actions.firing-alerts', 'Firing alerts')}
          aria-label={t('home.header-actions.firing-alerts', 'Firing alerts')}
          icon="bell"
          onClick={() => alertIncidentRef.current?.switch(ALERTS_TAB_ID)}
        >
          <Stack direction="row" alignItems="center" gap={1}>
            {alertsData.count === 0 ? (
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

      {canViewIncidents && (
        <Button
          variant="secondary"
          tooltip={t('home.header-actions.active-incidents', 'Active incidents')}
          aria-label={t('home.header-actions.active-incidents', 'Active incidents')}
          icon="fire"
          onClick={() => alertIncidentRef.current?.switch(INCIDENTS_TAB_ID)}
        >
          <Stack direction="row" alignItems="center" gap={1}>
            {incidentsData.count === 0 ? (
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
