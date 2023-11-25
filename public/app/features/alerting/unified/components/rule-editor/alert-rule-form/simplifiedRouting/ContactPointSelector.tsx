import { css } from '@emotion/css';
import React from 'react';
import { useFormContext } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { Alert, Field, InputControl, LoadingPlaceholder, Select, Stack, useStyles2 } from '@grafana/ui';
import { RuleFormValues } from 'app/features/alerting/unified/types/rule-form';

import { ContactPointReceiverSummary } from '../../../contact-points/ContactPoints.v2';
import { useContactPointsWithStatus } from '../../../contact-points/useContactPoints';

export interface ContactPointSelectorProps {
  contactPointIndex: number;
}
export function ContactPointSelector({ contactPointIndex }: ContactPointSelectorProps) {
  const styles = useStyles2(getStyles);
  const { register, control } = useFormContext<RuleFormValues>();
  // const onChange = (value: SelectableValue<string>) => {
  //   dispatch(selectContactPoint({ receiver: value?.value, alertManager }));
  // };
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
      <Field label="Contact point" {...register(`contactPoints.${contactPointIndex}.selectedContactPoint`)}>
        <InputControl
          render={({ field: { onChange, ref, ...field } }) => (
            <div className={styles.contactPointsSelector}>
              <Select
                {...field}
                aria-label="Contact point"
                onChange={onChange}
                // We are passing a JSX.Element into the "description" for options, which isn't how the TS typings are defined.
                // The regular Select component will render it just fine, but we can't update the typings because SelectableValue
                // is shared with other components where the "description" _has_ to be a string.
                // I've tried unsuccessfully to separate the typings just I'm giving up :'(
                // @ts-ignore
                options={options}
                width={50}
              />
            </div>
          )}
          control={control}
          name={`contactPoints.${contactPointIndex}.selectedContactPoint`}
        />
      </Field>
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  contactPointsSelector: css({
    marginTop: theme.spacing(1),
  }),
});
