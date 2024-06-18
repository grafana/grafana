import { css } from '@emotion/css';
import React, { useId } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { Modal, Button, Stack, TextLink, Field, Input, Text, useStyles2, Alert } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

import { CreateSessionApiArg } from '../../../api';

interface Props {
  isOpen: boolean;
  isLoading: boolean;
  isError: boolean;
  hideModal: () => void;
  onConfirm: (connectStackData: CreateSessionApiArg) => Promise<unknown>;
}

interface FormData {
  token: string;
}

export const ConnectModal = ({ isOpen, isLoading, isError, hideModal, onConfirm }: Props) => {
  const tokenId = useId();
  const styles = useStyles2(getStyles);

  const {
    handleSubmit,
    register,
    formState: { errors },
    watch,
  } = useForm<FormData>({
    defaultValues: {
      token: '',
    },
  });

  const token = watch('token');

  const onConfirmConnect: SubmitHandler<FormData> = (formData) => {
    onConfirm({
      cloudMigrationSessionRequestDto: {
        authToken: formData.token,
      },
    }).then((resp) => {
      const didError = typeof resp === 'object' && resp && 'error' in resp;
      if (!didError) {
        hideModal();
      }
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      title={t('migrate-to-cloud.connect-modal.title', 'Connect to a cloud stack')}
      onDismiss={hideModal}
    >
      <form onSubmit={handleSubmit(onConfirmConnect)}>
        <Text color="secondary">
          <Stack direction="column" gap={2}>
            <Trans i18nKey="migrate-to-cloud.connect-modal.body-get-started">
              To get started, you&apos;ll need a Grafana.com account.
            </Trans>

            <div>
              <TextLink href="https://grafana.com/auth/sign-up/create-user?pg=prod-cloud" external>
                {t('migrate-to-cloud.connect-modal.body-sign-up', 'Sign up for a Grafana.com account')}
              </TextLink>
            </div>

            <Trans i18nKey="migrate-to-cloud.connect-modal.body-cloud-stack">
              You&apos;ll also need a cloud stack. If you just signed up, we&apos;ll automatically create your first
              stack. If you have an account, you&apos;ll need to select or create a stack.
            </Trans>

            <div>
              <TextLink href="https://grafana.com/auth/sign-in/" external>
                {t('migrate-to-cloud.connect-modal.body-view-stacks', 'View my cloud stacks')}
              </TextLink>
            </div>

            <div>
              <Trans i18nKey="migrate-to-cloud.connect-modal.body-token">
                Your self-managed Grafana installation needs special access to securely migrate content. You&apos;ll
                need to create a migration token on your chosen cloud stack.
              </Trans>
            </div>

            <div>
              <Trans i18nKey="migrate-to-cloud.connect-modal.body-token-instructions">
                Log into your cloud stack and navigate to Administration, General, Migrate to Grafana Cloud. Create a
                migration token on that screen and paste the token here.
              </Trans>
            </div>

            {isError && (
              <Alert
                severity="error"
                title={t('migrate-to-cloud.connect-modal.token-error-title', 'Error saving token')}
              >
                <Trans i18nKey="migrate-to-cloud.connect-modal.token-error-description">
                  There was an error saving the token. See the Grafana server logs for more details.
                </Trans>
              </Alert>
            )}

            <Field
              className={styles.field}
              invalid={!!errors.token}
              error={errors.token?.message}
              label={t('migrate-to-cloud.connect-modal.body-token-field', 'Migration token')}
              required
            >
              <Input
                {...register('token', {
                  required: t('migrate-to-cloud.connect-modal.token-required-error', 'Migration token is required'),
                })}
                id={tokenId}
                placeholder={t('migrate-to-cloud.connect-modal.body-token-field-placeholder', 'Paste token here')}
              />
            </Field>
          </Stack>
        </Text>

        <Modal.ButtonRow>
          <Button variant="secondary" onClick={hideModal}>
            <Trans i18nKey="migrate-to-cloud.connect-modal.cancel">Cancel</Trans>
          </Button>
          <Button type="submit" disabled={isLoading || !token}>
            {isLoading
              ? t('migrate-to-cloud.connect-modal.connecting', 'Connecting to this stack...')
              : t('migrate-to-cloud.connect-modal.connect', 'Connect to this stack')}
          </Button>
        </Modal.ButtonRow>
      </form>
    </Modal>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  field: css({
    alignSelf: 'stretch',
  }),
});
