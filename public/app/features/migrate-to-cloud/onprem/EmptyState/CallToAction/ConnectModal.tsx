import { css } from '@emotion/css';
import React, { useId, useState } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { Modal, Button, Stack, TextLink, Field, Input, Text, useStyles2 } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

import { CreateMigrationApiArg } from '../../../api';

interface Props {
  hideModal: () => void;
  onConfirm: (connectStackData: CreateMigrationApiArg) => Promise<void>;
}

interface FormData {
  token: string;
}

export const ConnectModal = ({ hideModal, onConfirm }: Props) => {
  const [isConnecting, setIsConnecting] = useState(false);
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

  const onConfirmConnect: SubmitHandler<FormData> = async (formData) => {
    setIsConnecting(true);
    // TODO: location of this is kinda weird, making it tricky to handle errors from this.
    await onConfirm({
      cloudMigrationRequest: {
        authToken: formData.token,
      },
    });
    setIsConnecting(false);
    hideModal();
  };

  return (
    <Modal isOpen title={t('migrate-to-cloud.connect-modal.title', 'Connect to a cloud stack')} onDismiss={hideModal}>
      <form onSubmit={handleSubmit(onConfirmConnect)}>
        <Text color="secondary">
          <Stack direction="column" gap={2} alignItems="flex-start">
            <Trans i18nKey="migrate-to-cloud.connect-modal.body-get-started">
              To get started, you&apos;ll need a Grafana.com account.
            </Trans>

            <TextLink href="https://grafana.com/auth/sign-up/create-user?pg=prod-cloud" external>
              {t('migrate-to-cloud.connect-modal.body-sign-up', 'Sign up for a Grafana.com account')}
            </TextLink>

            <Trans i18nKey="migrate-to-cloud.connect-modal.body-cloud-stack">
              You&apos;ll also need a cloud stack. If you just signed up, we&apos;ll automatically create your first
              stack. If you have an account, you&apos;ll need to select or create a stack.
            </Trans>

            <TextLink href="https://grafana.com/auth/sign-in/" external>
              {t('migrate-to-cloud.connect-modal.body-view-stacks', 'View my cloud stacks')}
            </TextLink>

            <span>
              <Trans i18nKey="migrate-to-cloud.connect-modal.body-token">
                Your self-managed Grafana installation needs special access to securely migrate content. You&apos;ll
                need to create a migration token on your chosen cloud stack.
              </Trans>
            </span>

            <span>
              <Trans i18nKey="migrate-to-cloud.connect-modal.body-token-instructions">
                Log into your cloud stack and navigate to Administration, General, Migrate to Grafana Cloud. Create a
                migration token on that screen and paste the token here.
              </Trans>
            </span>

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
          <Button type="submit" disabled={isConnecting || !token}>
            {isConnecting
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
