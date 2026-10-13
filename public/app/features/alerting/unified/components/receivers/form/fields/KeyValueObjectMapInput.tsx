import { css } from '@emotion/css';
import { useState } from 'react';
import { type DeepMap, type FieldError, type FieldValues, useFormContext } from 'react-hook-form';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, Input, Stack, useStyles2 } from '@grafana/ui';
import {
  type NotificationChannelOption,
  type NotificationChannelSecureFields,
  type OptionMeta,
} from 'app/features/alerting/unified/types/alerting';

import { ActionIcon } from '../../../rules/ActionIcon';

import { OptionField } from './OptionField';

interface Props {
  value?: Record<string, Record<string, unknown>>;
  option: NotificationChannelOption;
  pathPrefix: string;
  secureFieldPathPrefix: string;
  secureFields: NotificationChannelSecureFields;
  errors?: DeepMap<FieldValues, FieldError>;
  readOnly?: boolean;
  onChange: (value: Record<string, Record<string, unknown>>) => void;
  onResetSecureField?: (propertyName: string) => void;
  onDeleteSubform?: (settingsPath: string, option: NotificationChannelOption) => void;
  getOptionMeta?: (option: NotificationChannelOption) => OptionMeta;
}

export function KeyValueObjectMapInput({
  value,
  option,
  pathPrefix,
  secureFieldPathPrefix,
  secureFields,
  errors,
  readOnly = false,
  onChange,
  onResetSecureField,
  onDeleteSubform,
  getOptionMeta,
}: Props) {
  const styles = useStyles2(getStyles);
  const { unregister } = useFormContext();
  const [newKey, setNewKey] = useState('');
  const entries = Object.entries(value ?? {});

  const addEntry = () => {
    const key = newKey.trim();
    if (!key || Object.prototype.hasOwnProperty.call(value ?? {}, key)) {
      return;
    }

    const initialValue = Object.fromEntries(
      (option.subformOptions ?? []).map((field) => [field.propertyName, getDefaultValue(field)])
    );
    onChange({ ...(value ?? {}), [key]: initialValue });
    setNewKey('');
  };

  const deleteEntry = (key: string) => {
    const secureFieldPrefix = `${secureFieldPathPrefix}${option.propertyName}.${toSecurePathSegment(key)}.`;
    (option.subformOptions ?? []).forEach((field) => {
      resetSecureFields(field, secureFieldPrefix, onResetSecureField);
    });

    const nextValue = { ...(value ?? {}) };
    delete nextValue[key];
    onChange(nextValue);
    unregister(`${pathPrefix}${option.propertyName}${toFieldPathSegment(key)}`);
  };

  return (
    <div>
      {entries.map(([key, entryValue]) => {
        const fieldPathPrefix = `${pathPrefix}${option.propertyName}${toFieldPathSegment(key)}.`;
        const securePathPrefix = `${secureFieldPathPrefix}${option.propertyName}.${toSecurePathSegment(key)}.`;

        return (
          <section className={styles.entry} key={key}>
            <Stack alignItems="center" gap={1}>
              <Input aria-label={t('alerting.key-value-object-map-input.key', 'Name')} value={key} disabled />
              {!readOnly && (
                <ActionIcon
                  icon="trash-alt"
                  tooltip={t('alerting.common.delete', 'Delete')}
                  onClick={() => deleteEntry(key)}
                />
              )}
            </Stack>
            {(option.subformOptions ?? []).map((field) => (
              <OptionField
                key={field.propertyName}
                option={field}
                defaultValue={entryValue[field.propertyName]}
                pathPrefix={fieldPathPrefix}
                secureFieldPathPrefix={securePathPrefix}
                secureFields={secureFields}
                readOnly={readOnly}
                onResetSecureField={onResetSecureField}
                onDeleteSubform={onDeleteSubform}
                getOptionMeta={getOptionMeta}
                error={errors?.[key]?.[field.propertyName]}
              />
            ))}
          </section>
        );
      })}

      {!readOnly && (
        <Stack alignItems="center" gap={1}>
          <Input
            aria-label={t('alerting.key-value-object-map-input.new-key', 'New name')}
            placeholder={t('alerting.key-value-object-map-input.new-key-placeholder', 'Header name')}
            value={newKey}
            onChange={(event) => setNewKey(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addEntry();
              }
            }}
          />
          <Button
            type="button"
            variant="secondary"
            icon="plus"
            size="sm"
            disabled={!newKey.trim() || Object.prototype.hasOwnProperty.call(value ?? {}, newKey.trim())}
            onClick={addEntry}
          >
            <Trans i18nKey="alerting.key-value-object-map-input.add">Add</Trans>
          </Button>
        </Stack>
      )}
    </div>
  );
}

function getDefaultValue(option: NotificationChannelOption): unknown {
  if (option.defaultValue) {
    return option.defaultValue.value;
  }
  switch (option.element) {
    case 'string_array':
      return [];
    case 'key_value_map':
    case 'key_value_object_map':
      return {};
    case 'checkbox':
      return false;
    default:
      return '';
  }
}

function resetSecureFields(
  option: NotificationChannelOption,
  pathPrefix: string,
  onResetSecureField?: (propertyName: string) => void
) {
  if (option.secure) {
    onResetSecureField?.(option.secureFieldKey ?? `${pathPrefix}${option.propertyName}`);
  }
  (option.subformOptions ?? []).forEach((field) => {
    resetSecureFields(field, `${pathPrefix}${option.propertyName}.`, onResetSecureField);
  });
}

function toFieldPathSegment(key: string): string {
  if (/^[\w-]+$/.test(key)) {
    return `.${key}`;
  }
  return `[${JSON.stringify(key)}]`;
}

function toSecurePathSegment(key: string): string {
  return key.replace(/%/g, '%25').replace(/\./g, '%2E');
}

const getStyles = (theme: GrafanaTheme2) => ({
  entry: css({
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    marginBottom: theme.spacing(1),
    paddingBottom: theme.spacing(1),
  }),
});
