import { AnyAction, createAction, createReducer } from '@reduxjs/toolkit';
import React, { useReducer } from 'react';
import { useFormContext } from 'react-hook-form';

import { SelectableValue } from '@grafana/data/src/types';
import { Field, Icon, Select, Stack, Text } from '@grafana/ui';
import { useAlertmanagerConfig } from 'app/features/alerting/unified/hooks/useAlertmanagerConfig';
import { INTEGRATION_ICONS } from 'app/features/alerting/unified/types/contact-points';
import { AMContactPoint, RuleFormValues } from 'app/features/alerting/unified/types/rule-form';
import { extractReceivers } from 'app/features/alerting/unified/utils/receivers';
import { Receiver } from 'app/plugins/datasource/alertmanager/types';

import { ReceiverMetadataBadge } from '../../../receivers/grafanaAppReceivers/ReceiverMetadataBadge';
import { useReceiversMetadata } from '../../../receivers/grafanaAppReceivers/useReceiversMetadata';
import { useGetAlertManagersMetadata } from '../../notificaton-preview/useGetAlertManagersSourceNamesAndImage';

export const selectContactPoint = createAction<{ receiver: Receiver | undefined; alertManagerName: string }>(
  'simplifiedRouting/selectContactPoint'
);

export const receiversReducer = createReducer<AMContactPoint[]>([], (builder) => {
  builder.addCase(selectContactPoint, (state, action) => {
    const { receiver, alertManagerName } = action.payload;
    const newContactPoint: AMContactPoint = { selectedContactPoint: receiver, alertManagerName };
    const existingContactPointIndex = state.findIndex((cp) => cp.alertManagerName === alertManagerName);

    if (existingContactPointIndex !== -1) {
      state[existingContactPointIndex].selectedContactPoint = receiver;
    } else {
      state.push(newContactPoint);
    }
  });
});

export function SimplifiedRouting() {
  const { watch } = useFormContext<RuleFormValues & { location?: string }>();
  const contactPointsInAlert = watch('contactPoints');

  const alertManagerMetaData = useGetAlertManagersMetadata();

  const alertManagerMetaDataPostable = alertManagerMetaData.filter((am) => am.postable);
  // maybe we should no let use simplified routing if there are some alert managers that are not postable?

  // we merge the selected contact points with the alert manager names
  const alertManagersWithSelectedContactPoints = alertManagerMetaDataPostable.map((am) => {
    const selectedContactPoint = contactPointsInAlert?.find((cp) => cp.alertManagerName === am.name)
      ?.selectedContactPoint;
    return { alertManagerName: am.name, selectedContactPoint: selectedContactPoint };
  });

  // use reducer to keep the list of receivers
  const [receiversState, dispatch] = useReducer(receiversReducer, alertManagersWithSelectedContactPoints);

  const moreThanOneAM = alertManagerMetaDataPostable.length > 1;

  return receiversState.map((alertManagerContactPoint) => {
    return (
      <>
        {moreThanOneAM && alertManagerContactPoint.alertManagerName}
        <ContactPointSelector
          selectedReceiver={alertManagerContactPoint.selectedContactPoint}
          dispatch={dispatch}
          alertManagerName={alertManagerContactPoint.alertManagerName}
        />
      </>
    );
  });
}
export interface ContactPointSelectorProps {
  alertManagerName: string;
  selectedReceiver?: Receiver;
  dispatch: React.Dispatch<AnyAction>;
}
function ContactPointSelector({ selectedReceiver, alertManagerName, dispatch }: ContactPointSelectorProps) {
  const onChange = (value: SelectableValue<Receiver>) => {
    dispatch(selectContactPoint({ receiver: value?.value, alertManagerName }));
  };
  const { currentData } = useAlertmanagerConfig(alertManagerName, {
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });
  const config = currentData?.alertmanager_config;
  const receivers = config?.receivers ?? [];
  const receiversMetadata = useReceiversMetadata(config?.receivers ?? []);
  const options = receivers.map((receiver) => ({ label: receiver.name, value: receiver }));

  const onClearContactPoint = () => {
    dispatch(selectContactPoint({ receiver: undefined, alertManagerName })); // todo add remove action
  };
  const metadataForSelected = selectedReceiver ? receiversMetadata.get(selectedReceiver) : undefined;

  return (
    <Stack direction="column">
      <Field label="Contact point">
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
              <Stack direction="row" gap={1}>
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
      </Field>
      {/* todo add link to the contact point, and maybe add the description also? : this info is in the meta data */}
      {metadataForSelected && <ReceiverMetadataBadge metadata={metadataForSelected} />}
    </Stack>
  );
}
