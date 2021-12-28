import React from 'react';
import { Button, Field, Input } from '@grafana/ui';
import { OptionField } from './fields/OptionField';
import { ChannelValues, ReceiverFormValues } from '../../../types/receiver-form';
import { useFormContext, FieldError, FieldErrors, DeepMap } from 'react-hook-form';
import { NotificationChannelOption, NotificationChannelSecureFields } from 'app/types';

export interface Props<R extends ChannelValues> {
  defaultValues: R;
  selectedChannelOptions: NotificationChannelOption[];
  secureFields: NotificationChannelSecureFields;

  onResetSecureField: (key: string) => void;
  errors?: FieldErrors<R>;
  pathPrefix?: string;
  readOnly?: boolean;
}

export function ChannelOptions<R extends ChannelValues>({
  defaultValues,
  selectedChannelOptions,
  onResetSecureField,
  secureFields,
  errors,
  pathPrefix = '',
  readOnly = false,
}: Props<R>): JSX.Element {
  const { watch } = useFormContext<ReceiverFormValues<R>>();
  const currentFormValues = watch() as Record<string, any>; // react hook form types ARE LYING!
  return (
    <>
      {selectedChannelOptions.map((option: NotificationChannelOption, index: number) => {
        const key = `${option.label}-${index}`;
        // Some options can be dependent on other options, this determines what is selected in the dependency options
        // I think this needs more thought.
        const selectedOptionValue = currentFormValues[`${pathPrefix}settings.${option.showWhen.field}`];

        if (option.showWhen.field && selectedOptionValue !== option.showWhen.is) {
          return null;
        }

        if (secureFields && secureFields[option.propertyName]) {
          return (
            <Field key={key} label={option.label} description={option.description || undefined}>
              <Input
                readOnly={true}
                value="Configured"
                suffix={
                  readOnly ? null : (
                    <Button
                      onClick={() => onResetSecureField(option.propertyName)}
                      variant="link"
                      type="button"
                      size="sm"
                    >
                      Clear
                    </Button>
                  )
                }
              />
            </Field>
          );
        }

        const error: FieldError | DeepMap<any, FieldError> | undefined = ((option.secure
          ? errors?.secureSettings
          : errors?.settings) as DeepMap<any, FieldError> | undefined)?.[option.propertyName];

        const defaultValue = defaultValues?.settings?.[option.propertyName];

        return (
          <OptionField
            defaultValue={defaultValue}
            readOnly={readOnly}
            key={key}
            error={error}
            pathPrefix={option.secure ? `${pathPrefix}secureSettings.` : `${pathPrefix}settings.`}
            option={option}
          />
        );
      })}
    </>
  );
}
