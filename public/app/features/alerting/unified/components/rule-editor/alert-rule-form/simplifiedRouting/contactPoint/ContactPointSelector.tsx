import { css } from '@emotion/css';
import React from 'react';
import { useFormContext } from 'react-hook-form';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { ActionMeta, Field, FieldValidationMessage, InputControl, Select, Stack, useStyles2 } from '@grafana/ui';
import { RuleFormValues } from 'app/features/alerting/unified/types/rule-form';

import { ContactPointReceiverSummary } from '../../../../contact-points/ContactPoints';
import { ContactPointWithMetadata } from '../../../../contact-points/utils';

export interface ContactPointSelectorProps {
  alertManager: string;
  contactPoints: ContactPointWithMetadata[];
  onSelectContactPoint: (contactPoint?: ContactPointWithMetadata) => void;
}
export function ContactPointSelector({ alertManager, contactPoints, onSelectContactPoint }: ContactPointSelectorProps) {
  const styles = useStyles2(getStyles);
  const { control, watch } = useFormContext<RuleFormValues>();

  const options = contactPoints.map((receiver) => {
    const integrations = receiver?.grafana_managed_receiver_configs;
    const description = <ContactPointReceiverSummary receivers={integrations ?? []} />;

    return { label: receiver.name, value: receiver, description };
  });

  const selectedContactPointWithMetadata = options.find(
    (option) => option.value.name === watch(`contactPoints.${alertManager}.selectedContactPoint`)
  )?.value;
  const selectedContactPointSelectableValue = selectedContactPointWithMetadata
    ? { value: selectedContactPointWithMetadata, label: selectedContactPointWithMetadata.name }
    : undefined;

  return (
    <Stack direction="column">
      <Field label="Contact point">
        <InputControl
          render={({ field: { onChange, ref, ...field }, fieldState: { error } }) => (
            <>
              <div className={styles.contactPointsSelector}>
                <Select
                  {...field}
                  defaultValue={selectedContactPointSelectableValue}
                  aria-label="Contact point"
                  onChange={(value: SelectableValue<ContactPointWithMetadata>, _: ActionMeta) => {
                    onChange(value?.value?.name);
                    onSelectContactPoint(value?.value);
                  }}
                  // We are passing a JSX.Element into the "description" for options, which isn't how the TS typings are defined.
                  // The regular Select component will render it just fine, but we can't update the typings because SelectableValue
                  // is shared with other components where the "description" _has_ to be a string.
                  // I've tried unsuccessfully to separate the typings just I'm giving up :'(
                  // @ts-ignore
                  options={options}
                  width={50}
                />
              </div>
              {error && <FieldValidationMessage>{error.message}</FieldValidationMessage>}
            </>
          )}
          rules={{ required: { value: true, message: 'Contact point is required.' } }}
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
