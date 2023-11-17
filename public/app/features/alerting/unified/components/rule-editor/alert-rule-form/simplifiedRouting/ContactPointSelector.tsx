import { css } from '@emotion/css';
import React from 'react';
import { AnyAction } from 'redux';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Field, Icon, Select, Stack, Text, useStyles2 } from '@grafana/ui';
import { useAlertmanagerConfig } from 'app/features/alerting/unified/hooks/useAlertmanagerConfig';
import { INTEGRATION_ICONS } from 'app/features/alerting/unified/types/contact-points';
import { AlertManagerDataSource } from 'app/features/alerting/unified/utils/datasource';
import { extractReceivers } from 'app/features/alerting/unified/utils/receivers';

import { ReceiverMetadataBadge } from '../../../receivers/grafanaAppReceivers/ReceiverMetadataBadge';

import { selectContactPoint } from './SimplifiedRouting';
import { useReceiversMetadataMapByName } from './useReceiverMetadataByName';

export interface ContactPointSelectorProps {
  alertManager: AlertManagerDataSource;
  selectedReceiver?: string;
  dispatch: React.Dispatch<AnyAction>;
}
export function ContactPointSelector({ selectedReceiver, alertManager, dispatch }: ContactPointSelectorProps) {
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
                  <Text color="primary">{receiver ?? ''}</Text>
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
                            <Text color="secondary">{integration.name}</Text>
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
      {metadataForSelected && <ReceiverMetadataBadge metadata={metadataForSelected} />}
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  contactPointsSelector: css({
    marginTop: theme.spacing(1),
  }),
});
