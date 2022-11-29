import React from 'react';

import { Button, ConfirmModal, TextArea, HorizontalGroup, Field, Form } from '@grafana/ui';

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
  return (
    <Form defaultValues={defaultValues} onSubmit={onSubmit} key={defaultValues.configJSON}>
      {({ register, errors }) => (
        <>
          {!readOnly && (
            <Field
              disabled={loading}
              label="Configuration"
              invalid={!!errors.configJSON}
              error={errors.configJSON?.message}
            >
              <TextArea
                {...register('configJSON', {
                  required: { value: true, message: 'Required.' },
                  validate: (v) => {
                    try {
                      JSON.parse(v);
                      return true;
                    } catch (e) {
                      return e instanceof Error ? e.message : 'Invalid JSON.';
                    }
                  },
                })}
                id="configuration"
                rows={25}
              />
            </Field>
          )}
          {readOnly && (
            <Field label="Configuration">
              <pre data-testid="readonly-config">{defaultValues.configJSON}</pre>
            </Field>
          )}
          {!readOnly && (
            <HorizontalGroup>
              <Button type="submit" variant="primary" disabled={loading}>
                Save
              </Button>
              {onReset && (
                <Button type="button" disabled={loading} variant="destructive" onClick={onReset}>
                  Reset configuration
                </Button>
              )}
            </HorizontalGroup>
          )}
          {!!showConfirmDeleteAMConfig && onConfirmReset && onDismiss && (
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
        </>
      )}
    </Form>
  );
};
