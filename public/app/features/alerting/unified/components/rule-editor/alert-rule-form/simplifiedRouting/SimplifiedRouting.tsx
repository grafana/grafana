import { css } from '@emotion/css';
import { AnyAction, createAction, createReducer } from '@reduxjs/toolkit';
import React, { useEffect, useMemo, useReducer } from 'react';
import { useFormContext } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { SelectableValue } from '@grafana/data/src/types';
import { Field, Icon, Select, Stack, Text, useStyles2 } from '@grafana/ui';
import { onCallApi } from 'app/features/alerting/unified/api/onCallApi';
import { useAlertmanagerConfig } from 'app/features/alerting/unified/hooks/useAlertmanagerConfig';
import { usePluginBridge } from 'app/features/alerting/unified/hooks/usePluginBridge';
import { INTEGRATION_ICONS } from 'app/features/alerting/unified/types/contact-points';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';
import { RuleFormValues } from 'app/features/alerting/unified/types/rule-form';
import { extractReceivers } from 'app/features/alerting/unified/utils/receivers';
import { Receiver } from 'app/plugins/datasource/alertmanager/types';

import { ReceiverMetadataBadge } from '../../../receivers/grafanaAppReceivers/ReceiverMetadataBadge';
import { ReceiverTypes } from '../../../receivers/grafanaAppReceivers/onCall/onCall';
import { ReceiverPluginMetadata, getOnCallMetadata } from '../../../receivers/grafanaAppReceivers/useReceiversMetadata';
import {
  AlertManagerMetaData,
  useGetAlertManagersMetadata,
} from '../../notificaton-preview/useGetAlertManagersSourceNamesAndImage';

export interface AMContactPoint {
  alertManager: AlertManagerMetaData;
  selectedContactPoint?: string;
}

export const selectContactPoint = createAction<{ receiver: string | undefined; alertManager: AlertManagerMetaData }>(
  'simplifiedRouting/selectContactPoint'
);

export const receiversReducer = createReducer<AMContactPoint[]>([], (builder) => {
  builder.addCase(selectContactPoint, (state, action) => {
    const { receiver, alertManager } = action.payload;
    const newContactPoint: AMContactPoint = { selectedContactPoint: receiver, alertManager };
    const existingContactPointIndex = state.findIndex((cp) => cp.alertManager.name === alertManager.name);

    if (existingContactPointIndex !== -1) {
      state[existingContactPointIndex].selectedContactPoint = receiver;
    } else {
      state.push(newContactPoint);
    }
  });
});

export function SimplifiedRouting() {
  const { getValues, setValue } = useFormContext<RuleFormValues & { location?: string }>();
  const styles = useStyles2(getStyles);
  const contactPointsInAlert = getValues('contactPoints');

  const alertManagerMetaData = useGetAlertManagersMetadata();

  const alertManagerMetaDataPostable = alertManagerMetaData.filter((am) => am.postable);

  // we merge the selected contact points with the alert manager meta data
  const alertManagersWithSelectedContactPoints = alertManagerMetaDataPostable.map((am) => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alertManagersWithCPState]);

  //todo: decide what to do when there some alert managers not postable
  //const shouldShowAM = alertManagerMetaDataPostable.length > 1;
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
                <img src={alertManagerContactPoint.alertManager.img} alt="" className={styles.img} />
                {alertManagerContactPoint.alertManager.name}
              </div>
              <div className={styles.secondAlertManagerLine}></div>
            </Stack>
          )}
          <ContactPointSelector
            selectedReceiver={alertManagerContactPoint.selectedContactPoint}
            dispatch={dispatch}
            alertManager={alertManagerContactPoint.alertManager}
          />
        </Stack>
      </div>
    );
  });
}

export const useReceiversMetadataMapByName = (receivers: Receiver[]): Map<string, ReceiverPluginMetadata> => {
  const { installed: isOnCallEnabled } = usePluginBridge(SupportedPlugin.OnCall);
  const { data: onCallIntegrations = [] } = onCallApi.useGrafanaOnCallIntegrationsQuery(undefined, {
    skip: !isOnCallEnabled,
  });

  return useMemo(() => {
    const result = new Map<string, ReceiverPluginMetadata>();

    receivers.forEach((receiver) => {
      const onCallReceiver = receiver.grafana_managed_receiver_configs?.find((c) => c.type === ReceiverTypes.OnCall);

      if (onCallReceiver) {
        if (!isOnCallEnabled) {
          result.set(receiver.name, getOnCallMetadata(null, onCallReceiver));
          return;
        }

        result.set(receiver.name, getOnCallMetadata(onCallIntegrations, onCallReceiver));
      }
    });

    return result;
  }, [receivers, isOnCallEnabled, onCallIntegrations]);
};
export interface ContactPointSelectorProps {
  alertManager: AlertManagerMetaData;
  selectedReceiver?: string;
  dispatch: React.Dispatch<AnyAction>;
}
function ContactPointSelector({ selectedReceiver, alertManager, dispatch }: ContactPointSelectorProps) {
  const styles = useStyles2(getStyles);
  const onChange = (value: SelectableValue<string>) => {
    dispatch(selectContactPoint({ receiver: value?.value, alertManager }));
  };
  const { currentData } = useAlertmanagerConfig(alertManager.name, {
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });
  const config = currentData?.alertmanager_config;
  const receivers = config?.receivers ?? [];
  const receiversMetadata = useReceiversMetadataMapByName(config?.receivers ?? []);
  const options = receivers.map((receiver) => ({ label: receiver.name, value: receiver.name }));
  const metadataForSelected = selectedReceiver ? receiversMetadata.get(selectedReceiver) : undefined;

  return (
    <Stack direction="column">
      <Field label="Contact point">
        <div className={styles.contactPointsSelector}>
          <Select
            aria-label="Contact point"
            onChange={onChange}
            options={options}
            width={50}
            value={selectedReceiver}
            getOptionLabel={(option: SelectableValue<string>) => {
              const receiver = option?.value;
              const receiverMetadata = receiver ? receiversMetadata.get(receiver) : undefined;
              const selectedReceiverData = receivers.find((r) => r.name === receiver);

              const integrations = selectedReceiverData && extractReceivers(selectedReceiverData);
              return (
                <Stack direction="row" gap={1} alignItems="center">
                  {receiver}
                  {integrations?.map((integration, index) => {
                    const iconName =
                      INTEGRATION_ICONS[selectedReceiverData?.grafana_managed_receiver_configs?.[index]?.type ?? ''];
                    return (
                      <div key={index}>
                        <Stack direction="row" alignItems="center" gap={0.5}>
                          {receiverMetadata ? (
                            <ReceiverMetadataBadge metadata={receiverMetadata} />
                          ) : iconName ? (
                            <Icon name={iconName} />
                          ) : (
                            <Text variant="body" color="primary">
                              {integration.name}
                            </Text>
                          )}
                        </Stack>
                      </div>
                    );
                  })}
                </Stack>
              );
            }}
          />
        </div>
      </Field>
      {/* todo add link to the contact point, and maybe add the description also? : this info is in the meta data */}
      {metadataForSelected && <ReceiverMetadataBadge metadata={metadataForSelected} />}
    </Stack>
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
  contactPointsSelector: css({
    marginTop: theme.spacing(1),
  }),
});
