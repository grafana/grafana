import React from 'react';
import { useFormContext, FieldError, FieldErrors, DeepMap } from 'react-hook-form';

import { Button, Field, Input } from '@grafana/ui';
import { NotificationChannelOption, NotificationChannelSecureFields } from 'app/types';

import { ChannelValues, ReceiverFormValues } from '../../../types/receiver-form';

import { OptionField } from './fields/OptionField';

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
  const currentFormValues = watch(); // react hook form types ARE LYING!
  return (
    <>
      {selectedChannelOptions.map((option: NotificationChannelOption, index: number) => {
        const key = `${option.label}-${index}`;
        // Some options can be dependent on other options, this determines what is selected in the dependency options
        // I think this needs more thought.
        // pathPrefix = items.index.
        const paths = pathPrefix.split('.');
        const selectedOptionValue =
          paths.length >= 2 ? currentFormValues.items[Number(paths[1])].settings[option.showWhen.field] : undefined;

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
                    <Button onClick={() => onResetSecureField(option.propertyName)} fill="text" type="button" size="sm">
                      Clear
                    </Button>
                  )
                }
              />
            </Field>
          );
        }

        const error: FieldError | DeepMap<any, FieldError> | undefined = (
          (option.secure ? errors?.secureSettings : errors?.settings) as DeepMap<any, FieldError> | undefined
        )?.[option.propertyName];

        const defaultValue = defaultValues?.settings?.[option.propertyName];

        return (
          <OptionField
            defaultValue={defaultValue}
            readOnly={readOnly}
            key={key}
            error={error}
            pathPrefix={pathPrefix}
            pathSuffix={option.secure ? 'secureSettings.' : 'settings.'}
            option={option}
          />
        );
      })}
    </>
  );
}
