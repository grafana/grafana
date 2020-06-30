import React, { FC } from 'react';
import { SelectableValue } from '@grafana/data';
import { Field, FormAPI, InfoBox } from '@grafana/ui';
import { OptionElement } from './OptionElement';
import { NotificationChannel, NotificationChannelDTO, Option } from '../../../types';

interface Props extends Omit<FormAPI<NotificationChannelDTO>, 'formState' | 'getValues' | 'watch'> {
  selectedChannel: NotificationChannel;
  currentFormValues: NotificationChannelDTO;
}

export const NotificationChannelOptions: FC<Props> = ({
  control,
  currentFormValues,
  errors,
  selectedChannel,
  register,
}) => {
  return (
    <>
      <h3>{selectedChannel.heading}</h3>
      {selectedChannel.info !== '' && <InfoBox>{selectedChannel.info}</InfoBox>}
      {selectedChannel.options.map((option: Option, index: number) => {
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
            <OptionElement option={option} register={register} control={control} />
          </Field>
        );
      })}
    </>
  );
};
