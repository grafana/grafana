import { css } from '@emotion/css';
import { createAction, createReducer } from '@reduxjs/toolkit';
import React, { useEffect, useReducer } from 'react';
import { useFormContext } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, Link, Stack, Text, useStyles2 } from '@grafana/ui';
import { AlertmanagerProvider } from 'app/features/alerting/unified/state/AlertmanagerContext';
import { RuleFormValues } from 'app/features/alerting/unified/types/rule-form';
import {
  AlertManagerDataSource,
  getAlertManagerDataSourcesByPermission,
} from 'app/features/alerting/unified/utils/datasource';
import { createUrl } from 'app/features/alerting/unified/utils/url';

import { ContactPointSelector } from './ContactPointSelector';

export interface AMContactPoint {
  alertManager: AlertManagerDataSource;
  selectedContactPoint?: string;
}

export const selectContactPoint = createAction<{ receiver: string | undefined; alertManager: AlertManagerDataSource }>(
  'simplifiedRouting/selectContactPoint'
);

export const receiversReducer = createReducer<AMContactPoint[]>([], (builder) => {
  builder.addCase(selectContactPoint, (state, action) => {
    const { receiver, alertManager } = action.payload;
    const newContactPoint: AMContactPoint = { selectedContactPoint: receiver, alertManager };
    const existingContactPoint = state.find((cp) => cp.alertManager.name === alertManager.name);

    if (existingContactPoint) {
      existingContactPoint.selectedContactPoint = receiver;
    } else {
      state.push(newContactPoint);
    }
  });
});

export function SimplifiedRouting() {
  const { getValues, setValue } = useFormContext<RuleFormValues & { location?: string }>();
  const styles = useStyles2(getStyles);
  const contactPointsInAlert = getValues('contactPoints');

  const allAlertManagersByPermission = getAlertManagerDataSourcesByPermission('notification');

  const alertManagersDataSources = allAlertManagersByPermission.availableInternalDataSources.concat(
    allAlertManagersByPermission.availableExternalDataSources
  );

  const alertManagersDataSourcesWithConfigAPI = alertManagersDataSources.filter((am) => am.hasConfigurationAPI);

  // we merge the selected contact points with the alert manager meta data
  const alertManagersWithSelectedContactPoints = alertManagersDataSourcesWithConfigAPI.map((am) => {
    const selectedContactPoint = contactPointsInAlert?.find((cp) => cp.alertManager === am.name);
    return { alertManager: am, selectedContactPoint: selectedContactPoint?.selectedContactPoint };
  });

  // use reducer to keep this alertManagersWithSelectedContactPoints in the state
  const [alertManagersWithCPState, dispatch] = useReducer(receiversReducer, alertManagersWithSelectedContactPoints);

  function getContactPointsForForm(alertManagersWithCP: AMContactPoint[]) {
    return alertManagersWithCP.map((am) => {
      return { alertManager: am.alertManager.name, selectedContactPoint: am.selectedContactPoint };
    });
  }

  // whenever we update the receiversState we have to update the form too
  useEffect(() => {
    const contactPointsForForm = getContactPointsForForm(alertManagersWithCPState);
    setValue('contactPoints', contactPointsForForm, { shouldValidate: false });
  }, [alertManagersWithCPState, setValue]);

  const shouldShowAM = true;

  return alertManagersWithCPState.map((alertManagerContactPoint, index) => {
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
                {alertManagerContactPoint.alertManager.name}
              </div>
              <div className={styles.secondAlertManagerLine}></div>
            </Stack>
          )}
          <Stack direction="row" gap={1} alignItems="center">
            <AlertmanagerProvider
              accessType={'notification'}
              alertmanagerSourceName={alertManagerContactPoint.alertManager.name}
            >
              <ContactPointSelector
                selectedReceiver={alertManagerContactPoint.selectedContactPoint}
                dispatch={dispatch}
                alertManager={alertManagerContactPoint.alertManager}
              />
            </AlertmanagerProvider>
            <LinkToContactPoints />
          </Stack>
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
});
