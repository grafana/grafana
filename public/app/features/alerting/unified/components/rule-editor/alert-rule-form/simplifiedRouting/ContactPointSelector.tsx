import { css } from '@emotion/css';
import React from 'react';
import { useFormContext } from 'react-hook-form';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import {
  ActionMeta,
  Alert,
  Field,
  FieldValidationMessage,
  InputControl,
  LoadingPlaceholder,
  Select,
  Stack,
  useStyles2,
} from '@grafana/ui';
import { RuleFormValues } from 'app/features/alerting/unified/types/rule-form';

import { ContactPointReceiverSummary } from '../../../contact-points/ContactPoints.v2';
import { useContactPointsWithStatus } from '../../../contact-points/useContactPoints';

export interface ContactPointSelectorProps {
  alertManager: string;
}
export function ContactPointSelector({ alertManager }: ContactPointSelectorProps) {
  const styles = useStyles2(getStyles);
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<RuleFormValues>();

  const { isLoading, error: errorInContactPointStatus, contactPoints: receivers } = useContactPointsWithStatus();
  const options = receivers.map((receiver) => {
    const integrations = receiver?.grafana_managed_receiver_configs;
    const description = <ContactPointReceiverSummary receivers={integrations ?? []} />;

    return { label: receiver.name, value: receiver.name, description };
  });

  if (errorInContactPointStatus) {
    return <Alert title="Failed to fetch contact points" severity="error" />;
  }
  if (isLoading) {
    return <LoadingPlaceholder text={'Loading...'} />;
  }

  return (
    <Stack direction="column">
      <Field
        label="Contact point"
        {...register(`contactPoints.${alertManager}.selectedContactPoint`, { required: true })}
        invalid={!!errors.contactPoints?.[alertManager]?.selectedContactPoint}
      >
        <InputControl
          render={({ field: { onChange, ref, ...field }, fieldState: { error } }) => (
            <>
              <div className={styles.contactPointsSelector}>
                <Select
                  {...field}
                  aria-label="Contact point"
                  onChange={(value: SelectableValue<string>, _: ActionMeta) => onChange(value?.value)}
                  // We are passing a JSX.Element into the "description" for options, which isn't how the TS typings are defined.
                  // The regular Select component will render it just fine, but we can't update the typings because SelectableValue
                  // is shared with other components where the "description" _has_ to be a string.
                  // I've tried unsuccessfully to separate the typings just I'm giving up :'(
                  // @ts-ignore
                  options={options}
                  width={50}
                />
              </div>
              {error && <FieldValidationMessage>{'Contact point is required.'}</FieldValidationMessage>}
            </>
          )}
          control={control}
          name={`contactPoints.${alertManager}.selectedContactPoint`}
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
