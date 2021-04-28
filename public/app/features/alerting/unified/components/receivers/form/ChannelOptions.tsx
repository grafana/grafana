import React from 'react';
import { Button, Checkbox, Field, Input } from '@grafana/ui';
import { OptionElement } from './OptionElement';
import { ChannelValues, ReceiverFormValues } from '../../../types/receiver-form';
import { useFormContext, FieldError, NestDataObject } from 'react-hook-form';
import { NotificationChannelOption, NotificationChannelSecureFields } from 'app/types';

export interface Props<R extends ChannelValues> {
  selectedChannelOptions: NotificationChannelOption[];
  secureFields: NotificationChannelSecureFields;

  onResetSecureField: (key: string) => void;
  errors?: NestDataObject<R, FieldError>;
  pathPrefix?: string;
}

export function ChannelOptions<R extends ChannelValues>({
  selectedChannelOptions,
  onResetSecureField,
  secureFields,
  errors,
  pathPrefix = '',
}: Props<R>): JSX.Element {
  const { register, watch } = useFormContext<ReceiverFormValues<R>>();
  const currentFormValues = watch() as Record<string, any>; // react hook form types ARE LYING!
  return (
    <>
      {selectedChannelOptions.map((option: NotificationChannelOption, index: number) => {
        const key = `${option.label}-${index}`;
        // Some options can be dependent on other options, this determines what is selected in the dependency options
        // I think this needs more thought.
        const selectedOptionValue =
          currentFormValues[`${pathPrefix}settings.${option.showWhen.field}`] &&
          currentFormValues[`${pathPrefix}settings.${option.showWhen.field}`];

        if (option.showWhen.field && selectedOptionValue !== option.showWhen.is) {
          return null;
        }

        if (option.element === 'checkbox') {
          return (
            <Field key={key}>
              <Checkbox
                name={
                  option.secure
                    ? `${pathPrefix}secureSettings.${option.propertyName}`
                    : `${pathPrefix}settings.${option.propertyName}`
                }
                ref={register()}
                label={option.label}
                description={option.description}
              />
            </Field>
          );
        }

        const error: FieldError | undefined = ((option.secure ? errors?.secureSettings : errors?.settings) as
          | Record<string, FieldError>
          | undefined)?.[option.propertyName];

        return (
          <Field
            key={key}
            label={option.label}
            description={option.description}
            invalid={!!error}
            error={error?.message}
          >
            {secureFields && secureFields[option.propertyName] ? (
              <Input
                readOnly={true}
                value="Configured"
                suffix={
                  <Button
                    onClick={() => onResetSecureField(option.propertyName)}
                    variant="link"
                    type="button"
                    size="sm"
                  >
                    Clear
                  </Button>
                }
              />
            ) : (
              <OptionElement pathPrefix={pathPrefix} option={option} />
            )}
          </Field>
        );
      })}
    </>
  );
}
