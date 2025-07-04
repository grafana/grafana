import { useCallback, useEffect } from 'react';

import { AppEvents } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { getAppEvents } from '@grafana/runtime';
import { Alert, Box, Modal, Spinner, Text } from '@grafana/ui';

import { useGetSecretQuery, useSecretMutation } from '../api';
import { SecretFormValues } from '../types';
import { getErrorMessage, getFieldErrors, secretToSecretFormValues } from '../utils';

import { SecretForm } from './SecretForm';

interface EditSecretModalProps {
  name?: string;
  isOpen: boolean;
  onDismiss: () => void;
}

const appEvents = getAppEvents();

export function EditSecretModal({ isOpen, onDismiss, name }: EditSecretModalProps) {
  const {
    data: secret,
    isLoading,
    isUninitialized,
  } = useGetSecretQuery(name ?? '', {
    skip: !name,
  });
  const isNew = isUninitialized;
  const [mutation, { data: response, error, isSuccess }] = useSecretMutation(!isNew);
  const fieldError = getFieldErrors(error);
  const initialValues = isNew ? undefined : secretToSecretFormValues(secret);
  const modalTitle = isNew
    ? t('secrets.edit-modal.title.create', 'Create secret')
    : t('secrets.edit-modal.title.edit', 'Edit secret {{name}}', { name: secret?.name ?? '' });
  const submitText = isNew
    ? t('secrets.edit-modal.form.button-create', 'Create')
    : t('secrets.edit-modal.form.button-update', 'Update');

  const handleSubmit = useCallback(
    (data: SecretFormValues) => {
      return mutation(data);
    },
    [mutation]
  );

  useEffect(() => {
    if (isSuccess) {
      const name = response.metadata.name;
      const message = isNew
        ? t('secrets.mutation-success.create', 'Secret "{{name}}" was created successfully', {
            name,
          })
        : t('secrets.mutation-success.update', 'Secret "{{name}}" was updated successfully', {
            name,
          });
      appEvents.publish({
        type: AppEvents.alertSuccess.name,
        payload: [message],
      });
      onDismiss();
    }
  }, [isNew, isSuccess, onDismiss, response]);

  return (
    <Modal title={modalTitle} isOpen={isOpen} onDismiss={onDismiss} closeOnBackdropClick={false}>
      {isLoading && <Spinner />}
      {!isLoading && (
        <div>
          {!!error && !fieldError && (
            <Alert severity="error" title={t('secrets.mutation-error.title', 'Request error')}>
              {isNew
                ? t(
                    'secrets.mutation-error.create',
                    'Failed to create secret. Please try again, and if the problem persists, contact support'
                  )
                : t(
                    'secrets.mutation-error.update',
                    'Failed to update secret. Please try again, and if the problem persists, contact support'
                  )}

              <Box marginTop={1}>
                <Trans i18nKey="secrets.error-state.details" values={{ message: getErrorMessage(error) }}>
                  <Text italic>Details: {'{{message}}'}</Text>
                </Trans>
              </Box>
            </Alert>
          )}
          <SecretForm
            disableNameField={!isNew}
            submitText={submitText}
            initialValues={initialValues}
            onSubmit={handleSubmit}
            onCancel={onDismiss}
            externalErrors={fieldError}
          />
        </div>
      )}
    </Modal>
  );
}
