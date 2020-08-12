import React, { FC } from 'react';
import { SelectableValue } from '@grafana/data';
import { Button, Field, FormAPI, InfoBox, Input } from '@grafana/ui';
import { OptionElement } from './OptionElement';
import { NotificationChannelType, NotificationChannelDTO, NotificationChannelOption } from '../../../types';

interface Props extends Omit<FormAPI<NotificationChannelDTO>, 'formState' | 'getValues' | 'watch'> {
  selectedChannel: NotificationChannelType;
  currentFormValues: NotificationChannelDTO;
  onResetSecureField: (key: string) => void;
}

export const NotificationChannelOptions: FC<Props> = ({
  control,
  currentFormValues,
  errors,
  selectedChannel,
  register,
  onResetSecureField,
}) => {
  return (
    <>
      <h3>{selectedChannel.heading}</h3>
      {selectedChannel.info !== '' && <InfoBox>{selectedChannel.info}</InfoBox>}
      {selectedChannel.options.map((option: NotificationChannelOption, index: number) => {
        const key = `${option.label}-${index}`;
        // Some options can be dependent on other options, this determines what is selected in the dependency options
        // I think this needs more thought.
        const selectedOptionValue =
          currentFormValues[`settings.${option.showWhen.field}`] &&
          (currentFormValues[`settings.${option.showWhen.field}`] as SelectableValue<string>).value;

        if (option.showWhen.field && selectedOptionValue !== option.showWhen.is) {
          return null;
        }

        return (
          <Field
            key={key}
            label={option.label}
            description={option.description}
            invalid={errors.settings && !!errors.settings[option.propertyName]}
            error={errors.settings && errors.settings[option.propertyName]?.message}
          >
            {currentFormValues.secureFields && currentFormValues.secureFields[option.propertyName] ? (
              <Input
                readOnly={true}
                value="Configured"
                addonAfter={
                  <Button onClick={() => onResetSecureField(option.propertyName)} variant="secondary" type="button">
                    Reset
                  </Button>
                }
              />
            ) : (
              <OptionElement option={option} register={register} control={control} />
            )}
          </Field>
        );
      })}
    </>
  );
};
