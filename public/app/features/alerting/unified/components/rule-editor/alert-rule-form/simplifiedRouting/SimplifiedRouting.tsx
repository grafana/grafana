import { css } from '@emotion/css';
import { AnyAction, createAction, createReducer } from '@reduxjs/toolkit';
import React, { useReducer } from 'react';
import { useFormContext } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { SelectableValue } from '@grafana/data/src/types';
import { Field, Icon, Select, Stack, Text, useStyles2 } from '@grafana/ui';
import { useAlertmanagerConfig } from 'app/features/alerting/unified/hooks/useAlertmanagerConfig';
import { INTEGRATION_ICONS } from 'app/features/alerting/unified/types/contact-points';
import { AMContactPoint, RuleFormValues } from 'app/features/alerting/unified/types/rule-form';
import { extractReceivers } from 'app/features/alerting/unified/utils/receivers';
import { Receiver } from 'app/plugins/datasource/alertmanager/types';

import { ReceiverMetadataBadge } from '../../../receivers/grafanaAppReceivers/ReceiverMetadataBadge';
import { useReceiversMetadata } from '../../../receivers/grafanaAppReceivers/useReceiversMetadata';
import {
  AlertManagerMetaData,
  useGetAlertManagersMetadata,
} from '../../notificaton-preview/useGetAlertManagersSourceNamesAndImage';

export const selectContactPoint = createAction<{ receiver: Receiver | undefined; alertManager: AlertManagerMetaData }>(
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
  const { watch } = useFormContext<RuleFormValues & { location?: string }>();
  const styles = useStyles2(getStyles);
  const contactPointsInAlert = watch('contactPoints');

  const alertManagerMetaData = useGetAlertManagersMetadata();

  const alertManagerMetaDataPostable = alertManagerMetaData.filter((am) => am.postable);
  // maybe we should no let use simplified routing if there are some alert managers that are not postable?

  // we merge the selected contact points with the alert manager names
  const alertManagersWithSelectedContactPoints = alertManagerMetaDataPostable.map((am) => {
    const selectedContactPoint = contactPointsInAlert?.find((cp) => cp.alertManager.name === am.name)
      ?.selectedContactPoint;
    return { alertManager: am, selectedContactPoint: selectedContactPoint };
  });

  // use reducer to keep the list of receivers
  const [receiversState, dispatch] = useReducer(receiversReducer, alertManagersWithSelectedContactPoints);

  //const shouldShowAM = alertManagerMetaDataPostable.length > 1;
  const shouldShowAM = true;

  return receiversState.map((alertManagerContactPoint, index) => {
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
export interface ContactPointSelectorProps {
  alertManager: AlertManagerMetaData;
  selectedReceiver?: Receiver;
  dispatch: React.Dispatch<AnyAction>;
}
function ContactPointSelector({ selectedReceiver, alertManager, dispatch }: ContactPointSelectorProps) {
  const styles = useStyles2(getStyles);
  const onChange = (value: SelectableValue<Receiver>) => {
    dispatch(selectContactPoint({ receiver: value?.value, alertManager }));
  };
  const { currentData } = useAlertmanagerConfig(alertManager.name, {
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });
  const config = currentData?.alertmanager_config;
  const receivers = config?.receivers ?? [];
  const receiversMetadata = useReceiversMetadata(config?.receivers ?? []);
  const options = receivers.map((receiver) => ({ label: receiver.name, value: receiver }));

  const onClearContactPoint = () => {
    dispatch(selectContactPoint({ receiver: undefined, alertManager })); // todo add remove action
  };
  const metadataForSelected = selectedReceiver ? receiversMetadata.get(selectedReceiver) : undefined;

  return (
    <Stack direction="column">
      <Field label="Contact point">
        <div className={styles.contactPointsSelector}>
          <Select
            aria-label="Contact point"
            onChange={onChange}
            options={options}
            isClearable
            width={50}
            onClear={onClearContactPoint}
            defaultValue={selectedReceiver}
            getOptionLabel={(option: SelectableValue<Receiver>) => {
              const receiver = option?.value;

              const metadata = receiver ? receiversMetadata.get(receiver) : undefined;
              const integrations = receiver && extractReceivers(receiver);
              return (
                <Stack direction="row" gap={1} alignItems="center">
                  {receiver?.name}
                  {integrations?.map((integration, index) => {
                    const iconName = INTEGRATION_ICONS[receiver?.grafana_managed_receiver_configs?.[index]?.type ?? ''];
                    return (
                      <div key={index}>
                        <Stack direction="row" alignItems="center" gap={0.5}>
                          {metadata ? (
                            <ReceiverMetadataBadge metadata={metadata} />
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
