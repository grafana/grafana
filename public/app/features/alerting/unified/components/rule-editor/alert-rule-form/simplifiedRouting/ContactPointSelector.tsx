import { css } from '@emotion/css';
import React from 'react';
import { AnyAction } from 'redux';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Alert, Field, LoadingPlaceholder, Select, Stack, Text, useStyles2 } from '@grafana/ui';
import { AlertManagerDataSource } from 'app/features/alerting/unified/utils/datasource';

import { ContactPointReceiverSummary } from '../../../contact-points/ContactPoints.v2';
import { useContactPointsWithStatus } from '../../../contact-points/useContactPoints';

import { selectContactPoint } from './SimplifiedRouting';

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
  const { isLoading, error, contactPoints: receivers } = useContactPointsWithStatus();
  const options = receivers.map((receiver) => ({ label: receiver.name, value: receiver.name }));

  if (error) {
    return <Alert title="Failed to fetch contact points" severity="error" />;
  }
  if (isLoading) {
    return <LoadingPlaceholder text={'Loading...'} />;
  }

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
              const selectedReceiverData = receivers.find((r) => r.name === receiver);
              const integrations = selectedReceiverData?.grafana_managed_receiver_configs;

              return (
                <Stack direction="column" gap={0}>
                  <Text color="primary">{selectedReceiverData?.name ?? 'Unknown'}</Text>
                  <Text color="secondary">
                    <ContactPointReceiverSummary receivers={integrations ?? []} />
                  </Text>
                </Stack>
              );
            }}
          />
        </div>
      </Field>
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  contactPointsSelector: css({
    marginTop: theme.spacing(1),
  }),
});
