import React, { useId, useState } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';

import { Modal, Button, Stack, TextLink, Field, Input, Text } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

import { ConnectStackDTO } from '../../../api';

interface Props {
  hideModal: () => void;
  onConfirm: (connectStackData: ConnectStackDTO) => Promise<{ data: void } | { error: unknown }>;
}

export const ConnectModal = ({ hideModal, onConfirm }: Props) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const cloudStackId = useId();
  const tokenId = useId();

  const {
    handleSubmit,
    register,
    formState: { errors },
    watch,
  } = useForm<ConnectStackDTO>({
    mode: 'onBlur',
    defaultValues: {
      stackURL: '',
      token: '',
    },
  });

  const stackURL = watch('stackURL');
  const token = watch('token');

  const onConfirmConnect: SubmitHandler<ConnectStackDTO> = async (formData) => {
    setIsConnecting(true);
    await onConfirm(formData);
    setIsConnecting(false);
    hideModal();
  };

  return (
    <Modal isOpen title={t('migrate-to-cloud.connect-modal.title', 'Connect to a cloud stack')} onDismiss={hideModal}>
      <form onSubmit={handleSubmit(onConfirmConnect)}>
        <Text color="secondary">
          <Stack direction="column" gap={2}>
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
            <Trans i18nKey="migrate-to-cloud.connect-modal.body-paste-stack">
              Once you&apos;ve decided on a stack, paste the URL below.
            </Trans>
            <Field
              invalid={!!errors.stackURL}
              error={errors.stackURL?.message}
              label={t('migrate-to-cloud.connect-modal.body-url-field', 'Cloud stack URL')}
            >
              <Input
                {...register('stackURL', {
                  required: t('migrate-to-cloud.connect-modal.stack-required-error', 'Stack URL is required'),
                })}
                id={cloudStackId}
                placeholder="https://example.grafana.net/"
              />
            </Field>
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
              invalid={!!errors.token}
              error={errors.token?.message}
              label={t('migrate-to-cloud.connect-modal.body-token-field', 'Migration token')}
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
          <Button type="submit" disabled={isConnecting || !(stackURL && token)}>
            {isConnecting
              ? t('migrate-to-cloud.connect-modal.connecting', 'Connecting to this stack...')
              : t('migrate-to-cloud.connect-modal.connect', 'Connect to this stack')}
          </Button>
        </Modal.ButtonRow>
      </form>
    </Modal>
  );
};
