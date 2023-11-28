import { css } from '@emotion/css';
import React, { useMemo } from 'react';
import { useFormContext } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { CollapsableSection, Icon, Link, Stack, Text, useStyles2 } from '@grafana/ui';
import { AlertmanagerProvider } from 'app/features/alerting/unified/state/AlertmanagerContext';
import { RuleFormValues } from 'app/features/alerting/unified/types/rule-form';
import { getAlertManagerDataSourcesByPermission } from 'app/features/alerting/unified/utils/datasource';
import { createUrl } from 'app/features/alerting/unified/utils/url';

import { ContactPointSelector } from './ContactPointSelector';
import { MuteTimingFields } from './MuteTimingFields';
import { RoutingSettings } from './RouteSettings';

export interface SimplifiedRoutingProps {
  toggleOpenRoutingSettings: (nextValue: boolean) => void;
  isOpenRoutingSettings: boolean;
}

export function SimplifiedRouting({ toggleOpenRoutingSettings, isOpenRoutingSettings }: SimplifiedRoutingProps) {
  const { getValues } = useFormContext<RuleFormValues>();
  const styles = useStyles2(getStyles);
  const contactPointsInAlert = getValues('contactPoints');

  const allAlertManagersByPermission = getAlertManagerDataSourcesByPermission('notification');

  // We decided to only show internal alert manager for now. Once we want to show external alert managers we can use this code
  // const alertManagersDataSources = allAlertManagersByPermission.availableInternalDataSources.concat(
  //   allAlertManagersByPermission.availableExternalDataSources
  // );

  const alertManagersDataSources = allAlertManagersByPermission.availableInternalDataSources;

  const alertManagersDataSourcesWithConfigAPI = alertManagersDataSources.filter((am) => am.hasConfigurationAPI);

  // we merge the selected contact points data for each alert manager, with the alert manager meta data
  const alertManagersWithSelectedContactPoints = useMemo(
    () =>
      alertManagersDataSourcesWithConfigAPI.map((am) => {
        const selectedContactPoint = contactPointsInAlert ? contactPointsInAlert[am.name] : undefined;
        return {
          alertManager: am,
          selectedContactPoint: selectedContactPoint?.selectedContactPoint ?? '',
          muteTimeIntervals: selectedContactPoint?.muteTimeIntervals ?? [],
          overrideGrouping: selectedContactPoint?.overrideGrouping ?? false,
          groupBy: selectedContactPoint?.groupBy ?? [],
          overrideTimings: selectedContactPoint?.overrideTimings ?? false,
          groupWaitValue: selectedContactPoint?.groupWaitValue ?? '',
          groupIntervalValue: selectedContactPoint?.groupIntervalValue ?? '',
          repeatIntervalValue: selectedContactPoint?.repeatIntervalValue ?? '',
        };
      }),
    [alertManagersDataSourcesWithConfigAPI, contactPointsInAlert]
  );

  const shouldShowAM = true;

  return alertManagersWithSelectedContactPoints.map((alertManagerContactPoint, index) => {
    const alertManagerName = alertManagerContactPoint.alertManager.name;
    return (
      <div key={index}>
        <Stack direction="column">
          {shouldShowAM && (
            <Stack direction="row" alignItems="center">
              <div className={styles.firstAlertManagerLine}></div>
              <div className={styles.alertManagerName}>
                {' '}
                Alert manager:
                <img
                  src={alertManagerContactPoint.alertManager.imgUrl}
                  alt="Alert manager logo"
                  className={styles.img}
                />
                {alertManagerName}
              </div>
              <div className={styles.secondAlertManagerLine}></div>
            </Stack>
          )}
          <AlertmanagerProvider accessType={'notification'} alertmanagerSourceName={alertManagerName}>
            <Stack direction="row" gap={1} alignItems="center">
              <ContactPointSelector alertManager={alertManagerName} />
              <LinkToContactPoints />
            </Stack>
            <CollapsableSection
              label="Muting, grouping and timings"
              isOpen={isOpenRoutingSettings}
              className={styles.collapsableSection}
              onToggle={toggleOpenRoutingSettings}
            >
              <Stack direction="column" gap={1}>
                <MuteTimingFields alertManager={alertManagerName} />
                <RoutingSettings alertManager={alertManagerName} />
              </Stack>
            </CollapsableSection>
          </AlertmanagerProvider>
        </Stack>
      </div>
    );
  });
}

function LinkToContactPoints() {
  const hrefToContactPoints = '/alerting/notifications';
  return (
    <Link target="_blank" href={createUrl(hrefToContactPoints)} rel="noopener" aria-label="View alert rule">
      <Stack direction="row" gap={1} alignItems="center" justifyContent="center">
        <Text color="secondary">To browse contact points and create new ones go to</Text>
        <Text color="link">Contact points</Text>
        <Icon name={'external-link-alt'} size="sm" color="link" />
      </Stack>
    </Link>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  firstAlertManagerLine: css({
    height: 1,
    width: theme.spacing(4),
    backgroundColor: theme.colors.secondary.main,
  }),
  alertManagerName: css({
    with: 'fit-content',
  }),
  secondAlertManagerLine: css({
    height: '1px',
    width: '100%',
    flex: 1,
    backgroundColor: theme.colors.secondary.main,
  }),
  img: css({
    marginLeft: theme.spacing(2),
    width: theme.spacing(3),
    height: theme.spacing(3),
    marginRight: theme.spacing(1),
  }),
  collapsableSection: css({
    width: 'fit-content',
    fontSize: theme.typography.bodySmall.fontSize,
  }),
});
