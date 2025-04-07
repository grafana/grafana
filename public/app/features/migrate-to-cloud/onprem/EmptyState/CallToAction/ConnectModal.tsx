import { css } from '@emotion/css';
import { useId } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { Modal, Button, Stack, TextLink, Field, Input, Text, useStyles2 } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';
import { AlertWithTraceID } from 'app/features/migrate-to-cloud/shared/AlertWithTraceID';

import { CreateSessionApiArg } from '../../../api';
import { maybeAPIError } from '../../../api/errors';

interface Props {
  isOpen: boolean;
  isLoading: boolean;
  error: unknown;
  hideModal: () => void;
  onConfirm: (connectStackData: CreateSessionApiArg) => Promise<unknown>;
}

interface FormData {
  token: string;
}

function getTMessage(messageId: string): string {
  switch (messageId) {
    case 'cloudmigrations.createMigration.tokenInvalid':
      return t(
        'migrate-to-cloud.connect-modal.token-errors.token-invalid',
        'Token is not valid. Generate a new token on your cloud instance and try again.'
      );
    case 'cloudmigrations.createMigration.tokenRequestError':
      return t(
        'migrate-to-cloud.connect-modal.token-errors.token-request-error',
        'An error occurred while validating the token. Please check the Grafana instance logs.'
      );
    case 'cloudmigrations.createMigration.tokenValidationFailure':
      return t(
        'migrate-to-cloud.connect-modal.token-errors.token-validation-failure',
        'Token is not valid. Please ensure the token matches the migration token on your cloud instance.'
      );
    case 'cloudmigrations.createMigration.instanceUnreachable':
      return t(
        'migrate-to-cloud.connect-modal.token-errors.instance-unreachable',
        'The cloud instance cannot be reached. Make sure the instance is running and try again.'
      );
    case 'cloudmigrations.createMigration.instanceRequestError':
      return t(
        'migrate-to-cloud.connect-modal.token-errors.instance-request-error',
        "An error occurred while attempting to verify the cloud instance's connectivity. Please check the network settings or cloud instance status."
      );
    case 'cloudmigrations.createMigration.sessionCreationFailure':
      return t(
        'migrate-to-cloud.connect-modal.token-errors.session-creation-failure',
        'There was an error creating the migration. Please try again.'
      );
    case 'cloudmigrations.createMigration.migrationDisabled':
      return t(
        'migrate-to-cloud.connect-modal.token-errors.migration-disabled',
        'Cloud migrations are disabled on this instance.'
      );
    default:
      return t(
        'migrate-to-cloud.connect-modal.token-errors.token-not-saved',
        'There was an error saving the token. See the Grafana server logs for more details.'
      );
  }
}

export const ConnectModal = ({ isOpen, isLoading, error, hideModal, onConfirm }: Props) => {
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

            {error ? (
              <AlertWithTraceID
                error={error}
                severity="error"
                title={t('migrate-to-cloud.connect-modal.token-error-title', 'Error saving token')}
              >
                <Text element="p">
                  {getTMessage(maybeAPIError(error)?.messageId || '') ||
                    'There was an error saving the token. See the Grafana server logs for more details.'}
                </Text>
              </AlertWithTraceID>
            ) : undefined}

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
                data-testid="migrate-to-cloud-connect-session-modal-token-input"
              />
            </Field>
          </Stack>
        </Text>

        <Modal.ButtonRow>
          <Button variant="secondary" onClick={hideModal}>
            <Trans i18nKey="migrate-to-cloud.connect-modal.cancel">Cancel</Trans>
          </Button>
          <Button
            type="submit"
            disabled={isLoading || !token}
            data-testid="migrate-to-cloud-connect-session-modal-connect-button"
          >
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
