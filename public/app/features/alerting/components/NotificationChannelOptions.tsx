import React, { FC } from 'react';

import { SelectableValue } from '@grafana/data';
import { Button, Checkbox, Field, Input } from '@grafana/ui';

import { NotificationChannelDTO, NotificationChannelOption, NotificationChannelSecureFields } from '../../../types';

import { NotificationSettingsProps } from './NotificationChannelForm';
import { OptionElement } from './OptionElement';

interface Props extends NotificationSettingsProps {
  selectedChannelOptions: NotificationChannelOption[];
  currentFormValues: NotificationChannelDTO;
  secureFields: NotificationChannelSecureFields;

  onResetSecureField: (key: string) => void;
}

export const NotificationChannelOptions: FC<Props> = ({
  control,
  currentFormValues,
  errors,
  selectedChannelOptions,
  register,
  onResetSecureField,
  secureFields,
}) => {
  return (
    <>
      {selectedChannelOptions.map((option: NotificationChannelOption, index: number) => {
        const key = `${option.label}-${index}`;
        // Some options can be dependent on other options, this determines what is selected in the dependency options
        // I think this needs more thought.
        const selectedOptionValue =
          currentFormValues[`settings.${option.showWhen.field}`] &&
          (currentFormValues[`settings.${option.showWhen.field}`] as SelectableValue<string>).value;

        if (option.showWhen.field && selectedOptionValue !== option.showWhen.is) {
          return null;
        }

        if (option.element === 'checkbox') {
          return (
            <Field key={key}>
              <Checkbox
                {...register(
                  option.secure ? `secureSettings.${option.propertyName}` : `settings.${option.propertyName}`
                )}
                label={option.label}
                description={option.description}
              />
            </Field>
          );
        }
        return (
          <Field
            key={key}
            label={option.label}
            description={option.description}
            invalid={errors.settings && !!errors.settings[option.propertyName]}
            error={errors.settings && errors.settings[option.propertyName]?.message}
          >
            {secureFields && secureFields[option.propertyName] ? (
              <Input
                readOnly={true}
                value="Configured"
                suffix={
                  <Button onClick={() => onResetSecureField(option.propertyName)} fill="text" type="button" size="sm">
                    Clear
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
