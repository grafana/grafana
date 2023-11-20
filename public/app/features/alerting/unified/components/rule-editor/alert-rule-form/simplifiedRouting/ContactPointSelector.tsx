import { css } from '@emotion/css';
import React from 'react';
import { AnyAction } from 'redux';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Alert, Field, LoadingPlaceholder, Select, Stack, useStyles2 } from '@grafana/ui';
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
  const options = receivers.map((receiver) => {
    const integrations = receiver?.grafana_managed_receiver_configs;
    const description = <ContactPointReceiverSummary receivers={integrations ?? []} />;

    return { label: receiver.name, value: receiver.name, description };
  });

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
            // We are passing a JSX.Element into the "description" for options, which isn't how the TS typings are defined.
            // The regular Select component will render it just fine, but we can't update the typings because SelectableValue
            // is shared with other components where the "description" _has_ to be a string.
            // I've tried unsuccessfully to separate the typings just I'm giving up :'(
            // @ts-ignore
            options={options}
            width={50}
            value={selectedReceiver}
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
