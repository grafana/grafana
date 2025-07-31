import * as React from 'react';
import { DeepMap, FieldError, FieldErrors, useFormContext } from 'react-hook-form';

import { Field, SecretInput } from '@grafana/ui';
import { NotificationChannelOption, NotificationChannelSecureFields, OptionMeta } from 'app/types/alerting';

import {
  ChannelValues,
  CloudChannelValues,
  GrafanaChannelValues,
  ReceiverFormValues,
} from '../../../types/receiver-form';

import { OptionField } from './fields/OptionField';

export interface Props<R extends ChannelValues> {
  defaultValues: R;
  selectedChannelOptions: NotificationChannelOption[];

  onResetSecureField: (key: string) => void;
  onDeleteSubform?: (settingsPath: string, option: NotificationChannelOption) => void;
  errors?: FieldErrors<R>;
  /**
   * The path for the integration in the array of integrations.
   * This is used to access the settings and secure fields for the integration in a type-safe way.
   */
  integrationPrefix: `items.${number}`;
  readOnly?: boolean;

  customValidators?: Record<string, React.ComponentProps<typeof OptionField>['customValidator']>;
}

export function ChannelOptions<R extends ChannelValues>({
  defaultValues,
  selectedChannelOptions,
  onResetSecureField,
  onDeleteSubform,
  errors,
  integrationPrefix,
  readOnly = false,
  customValidators = {},
}: Props<R>): JSX.Element {
  const { watch } = useFormContext<ReceiverFormValues<CloudChannelValues | GrafanaChannelValues>>();

  const [settings, secureFields] = watch([`${integrationPrefix}.settings`, `${integrationPrefix}.secureFields`]);

  // Note: settingsPath includes a trailing dot for OptionField, unlike the path used in watch()
  const settingsPath = `${integrationPrefix}.settings.` as const;

  const getOptionMeta = (option: NotificationChannelOption): OptionMeta => ({
    required: determineRequired(option, settings, secureFields),
    readOnly: determineReadOnly(option, settings, secureFields),
  });

  return (
    <>
      {selectedChannelOptions.map((option: NotificationChannelOption, index: number) => {
        const key = `${option.label}-${index}`;
        // Some options can be dependent on other options, this determines what is selected in the dependency options
        // I think this needs more thought.
        // pathPrefix = items.index.
        // const paths = pathPrefix.split('.');
        const selectedOptionValue = settings?.[option.showWhen.field];

        if (option.showWhen.field && selectedOptionValue !== option.showWhen.is) {
          return null;
        }

        if (secureFields && secureFields[option.secureFieldKey ?? option.propertyName]) {
          return (
            <Field
              key={key}
              label={option.label}
              description={option.description}
              htmlFor={`${settingsPath}${option.propertyName}`}
            >
              <SecretInput
                id={`${settingsPath}${option.propertyName}`}
                onReset={() => onResetSecureField(option.secureFieldKey ?? option.propertyName)}
                isConfigured
              />
            </Field>
          );
        }

        const error: FieldError | DeepMap<any, FieldError> | undefined = (
          (option.secure ? errors?.secureFields : errors?.settings) as DeepMap<any, FieldError> | undefined
        )?.[option.secureFieldKey ?? option.propertyName];

        const defaultValue = defaultValues?.settings?.[option.propertyName];

        return (
          <OptionField
            secureFields={secureFields}
            onResetSecureField={onResetSecureField}
            onDeleteSubform={onDeleteSubform}
            defaultValue={defaultValue}
            readOnly={readOnly}
            key={key}
            error={error}
            pathPrefix={settingsPath}
            option={option}
            customValidator={customValidators[option.propertyName]}
            getOptionMeta={getOptionMeta}
          />
        );
      })}
    </>
  );
}

const determineRequired = (
  option: NotificationChannelOption,
  settings: Record<string, unknown>,
  secureFields: NotificationChannelSecureFields
) => {
  if (!option.required) {
    return false;
  }

  if (!option.dependsOn) {
    return option.required ? 'Required' : false;
  }

  // TODO: This doesn't work with nested secureFields.
  const dependentOn = Boolean(settings[option.dependsOn]) || Boolean(secureFields[option.dependsOn]);

  if (dependentOn) {
    return false;
  }

  return 'Required';
};

const determineReadOnly = (
  option: NotificationChannelOption,
  settings: Record<string, unknown>,
  secureFields: NotificationChannelSecureFields
) => {
  if (!option.dependsOn) {
    return false;
  }

  // TODO: This doesn't work with nested secureFields.
  return Boolean(settings[option.dependsOn]) || Boolean(secureFields[option.dependsOn]);
};
