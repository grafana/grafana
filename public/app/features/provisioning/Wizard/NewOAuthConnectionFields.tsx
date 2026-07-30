import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { Trans, t } from '@grafana/i18n';
import { Alert, Button, LoadingPlaceholder, Stack } from '@grafana/ui';
import { extractErrorMessage } from 'app/api/utils';

import { OAuthConnectionFields } from '../components/Shared/OAuthConnectionFields';
import { WebhookDisabledField } from '../components/Shared/WebhookDisabledField';
import { useCreateOrUpdateConnection } from '../hooks/useCreateOrUpdateConnection';
import { useOAuthAuthorizeFlow } from '../hooks/useOAuthAuthorizeFlow';
import { type ConnectionFormData, type OAuthConnectionType } from '../types';
import { connectionFormToSpec, getDefaultConnectionFormData } from '../utils/connectionData';
import { setConnectionFormErrors } from '../utils/getFormErrors';

interface NewOAuthConnectionFieldsProps {
  type: OAuthConnectionType;
  onAuthorized: (connectionName: string) => void;
}

export function NewOAuthConnectionFields({ type, onAuthorized }: NewOAuthConnectionFieldsProps) {
  const credentialForm = useForm<ConnectionFormData>({
    defaultValues: getDefaultConnectionFormData(type),
  });
  const [createdName, setCreatedName] = useState<string>();
  const [readyToAuthorize, setReadyToAuthorize] = useState(false);
  const [saveConnection, request] = useCreateOrUpdateConnection(createdName);
  const [submitError, setSubmitError] = useState<string>();
  const { authorize, cancelAuthorization, pendingName, authorizeError } = useOAuthAuthorizeFlow(onAuthorized);

  const handleCreate = async () => {
    setSubmitError(undefined);

    if (!(await credentialForm.trigger())) {
      return;
    }

    const form = credentialForm.getValues();

    try {
      const result = await saveConnection(connectionFormToSpec(form), undefined, form.clientSecret);
      const name = createdName ?? result.data?.metadata?.name;
      if (name && form.clientID) {
        setCreatedName(name);
        setReadyToAuthorize(true);
        authorize(type, form.clientID, name, form.serverUrl);
        return;
      }
      if (result.error && !setConnectionFormErrors(result.error, credentialForm.setError)) {
        setSubmitError(extractErrorMessage(result.error));
      }
    } catch (error) {
      if (!setConnectionFormErrors(error, credentialForm.setError)) {
        setSubmitError(
          extractErrorMessage(error) ||
            t('provisioning.wizard.oauth-app-creation-default-error', 'Failed to create connection')
        );
      }
    }
  };

  const handleAuthorize = () => {
    const form = credentialForm.getValues();
    if (createdName && form.clientID) {
      authorize(type, form.clientID, createdName, form.serverUrl);
    }
  };

  if (pendingName) {
    return (
      <Stack direction="column" gap={2}>
        <LoadingPlaceholder
          text={t('provisioning.wizard.oauth-app-waiting', 'Waiting for authorization in the other tab...')}
        />
        <Stack>
          <Button variant="secondary" onClick={cancelAuthorization}>
            <Trans i18nKey="provisioning.wizard.oauth-app-waiting-cancel">Cancel</Trans>
          </Button>
        </Stack>
      </Stack>
    );
  }

  if (readyToAuthorize && createdName) {
    return (
      <Stack direction="column" gap={2}>
        {authorizeError !== undefined && (
          <Alert severity="error" title={t('provisioning.wizard.oauth-app-authorize-failed', 'Authorization failed')}>
            {authorizeError && <div>{authorizeError}</div>}
            <Trans i18nKey="provisioning.wizard.oauth-app-authorize-failed-hint">
              Check the client ID and client secret, then try again.
            </Trans>
          </Alert>
        )}
        <Alert severity="info" title={t('provisioning.wizard.oauth-app-authorize-title', 'Authorization required')}>
          <Trans i18nKey="provisioning.wizard.oauth-app-authorize-body">
            Connection saved. Authorize the app to grant access.
          </Trans>
        </Alert>
        <Stack>
          <Button onClick={handleAuthorize}>
            <Trans i18nKey="provisioning.wizard.oauth-app-authorize-button">Authorize</Trans>
          </Button>
          <Button variant="secondary" onClick={() => setReadyToAuthorize(false)}>
            <Trans i18nKey="provisioning.wizard.oauth-app-authorize-back">Back</Trans>
          </Button>
        </Stack>
      </Stack>
    );
  }

  return (
    <FormProvider {...credentialForm}>
      <Stack direction="column" gap={2}>
        {submitError && <Alert severity="error" title={submitError} />}
        <OAuthConnectionFields
          required
          type={type}
          onNewConnectionCreation={handleCreate}
          isCreating={request.isLoading}
        />
        <WebhookDisabledField
          registration={credentialForm.register('webhookDisabled')}
          invalid={!!credentialForm.formState.errors.webhookDisabled}
          error={credentialForm.formState.errors.webhookDisabled?.message}
        />
      </Stack>
    </FormProvider>
  );
}
