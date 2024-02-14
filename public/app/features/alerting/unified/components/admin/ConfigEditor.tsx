import React from 'react';
import { useForm } from 'react-hook-form';

import { CodeEditor, ConfirmModal, Field } from '@grafana/ui';

import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';

import { FormValues } from './AlertmanagerConfig';

interface ConfigEditorProps {
  defaultValues: { configJSON: string };
  readOnly: boolean;
  loading: boolean;
  height: number;
  width: number;
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
  height,
  width,
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

  // manually set the validation for the configJSON field
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
        invalid={!!errors.configJSON}
        error={errors.configJSON?.message}
        data-testid={readOnly ? 'readonly-config' : 'config'}
      >
        <CodeEditor
          language="json"
          width={width}
          height={height}
          showLineNumbers={true}
          monacoOptions={{
            scrollBeyondLastLine: false,
          }}
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
