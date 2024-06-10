import React from 'react';
import { useForm } from 'react-hook-form';

import { Button, CodeEditor, ConfirmModal, Field, Stack } from '@grafana/ui';

import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';

import { FormValues } from './AlertmanagerConfig';

interface ConfigEditorProps {
  defaultValues: { configJSON: string };
  readOnly: boolean;
  loading: boolean;
  alertManagerSourceName?: string;
  onSubmit: (values: FormValues) => void;
  showConfirmDeleteAMConfig?: boolean;
  onReset?: () => void;
  onConfirmReset?: () => void;
  onDismiss?: () => void;
}

export const ConfigEditor = ({
  defaultValues,
  readOnly,
  loading,
  alertManagerSourceName,
  showConfirmDeleteAMConfig,
  onSubmit,
  onReset,
  onConfirmReset,
  onDismiss,
}: ConfigEditorProps) => {
  const {
    handleSubmit,
    formState: { errors },
    setValue,
    register,
  } = useForm({ defaultValues });

  register('configJSON', {
    required: { value: true, message: 'Required' },
    validate: (value: string) => {
      try {
        JSON.parse(value);
        return true;
      } catch (e) {
        return e instanceof Error ? e.message : 'JSON is invalid';
      }
    },
  });
  return (
    <form onSubmit={handleSubmit(onSubmit)} key={defaultValues.configJSON}>
      <Field
        disabled={loading}
        label="Configuration"
        invalid={!!errors.configJSON}
        error={errors.configJSON?.message}
        data-testid={readOnly ? 'readonly-config' : 'config'}
      >
        <CodeEditor
          language="json"
          width="100%"
          height={500}
          showLineNumbers={true}
          value={defaultValues.configJSON}
          showMiniMap={false}
          onSave={(value) => {
            setValue('configJSON', value);
          }}
          onBlur={(value) => {
            setValue('configJSON', value);
          }}
          readOnly={readOnly}
        />
      </Field>

      {!readOnly && (
        <Stack gap={1}>
          <Button type="submit" variant="primary" disabled={loading}>
            Save configuration
          </Button>
          {onReset && (
            <Button type="button" disabled={loading} variant="destructive" onClick={onReset}>
              Reset configuration
            </Button>
          )}
        </Stack>
      )}

      {Boolean(showConfirmDeleteAMConfig) && onConfirmReset && onDismiss && (
        <ConfirmModal
          isOpen={true}
          title="Reset Alertmanager configuration"
          body={`Are you sure you want to reset configuration ${
            alertManagerSourceName === GRAFANA_RULES_SOURCE_NAME
              ? 'for the Grafana Alertmanager'
              : `for "${alertManagerSourceName}"`
          }? Contact points and notification policies will be reset to their defaults.`}
          confirmText="Yes, reset configuration"
          onConfirm={onConfirmReset}
          onDismiss={onDismiss}
        />
      )}
    </form>
  );
};
