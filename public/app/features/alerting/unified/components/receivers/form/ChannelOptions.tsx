import * as React from 'react';
import { DeepMap, FieldError, FieldErrors, useFormContext } from 'react-hook-form';

import { Field, SecretInput } from '@grafana/ui';
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

  customValidators?: Record<string, React.ComponentProps<typeof OptionField>['customValidator']>;
}

export function ChannelOptions<R extends ChannelValues>({
  defaultValues,
  selectedChannelOptions,
  onResetSecureField,
  secureFields,
  errors,
  pathPrefix = '',
  readOnly = false,
  customValidators = {},
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
          paths.length >= 2 ? currentFormValues.items?.[Number(paths[1])].settings?.[option.showWhen.field] : undefined;

        if (option.showWhen.field && selectedOptionValue !== option.showWhen.is) {
          return null;
        }

        if (secureFields && secureFields[option.propertyName]) {
          return (
            <Field key={key} label={option.label} description={option.description}>
              <SecretInput onReset={() => onResetSecureField(option.propertyName)} isConfigured />
            </Field>
          );
        }

        const error: FieldError | DeepMap<any, FieldError> | undefined = (
          (option.secure ? errors?.secureSettings : errors?.settings) as DeepMap<any, FieldError> | undefined
        )?.[option.propertyName];

        const defaultValue = defaultValues?.settings?.[option.propertyName];

        return (
          <OptionField
            onResetSecureField={onResetSecureField}
            secureFields={secureFields}
            defaultValue={defaultValue}
            readOnly={readOnly}
            key={key}
            error={error}
            pathPrefix={pathPrefix}
            pathSuffix={option.secure ? 'secureSettings.' : 'settings.'}
            option={option}
            customValidator={customValidators[option.propertyName]}
          />
        );
      })}
    </>
  );
}
