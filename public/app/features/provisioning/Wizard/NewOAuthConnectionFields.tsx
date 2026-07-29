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
  const [createConnection, request] = useCreateOrUpdateConnection();
  const [submitError, setSubmitError] = useState<string>();
  const { openAuthTab, closeAuthTab, authorize, cancelAuthorization, pendingName } =
    useOAuthAuthorizeFlow(onAuthorized);

  const handleCreate = async () => {
    setSubmitError(undefined);
    openAuthTab();

    if (!(await credentialForm.trigger())) {
      closeAuthTab();
      return;
    }

    const form = credentialForm.getValues();

    try {
      const result = await createConnection(connectionFormToSpec(form), undefined, form.clientSecret);
      const name = result.data?.metadata?.name;
      if (name && form.clientID) {
        authorize(type, form.clientID, name, form.serverUrl);
        return;
      }
      closeAuthTab();
      if (result.error && !setConnectionFormErrors(result.error, credentialForm.setError)) {
        setSubmitError(extractErrorMessage(result.error));
      }
    } catch (error) {
      closeAuthTab();
      if (!setConnectionFormErrors(error, credentialForm.setError)) {
        setSubmitError(
          extractErrorMessage(error) ||
            t('provisioning.wizard.oauth-app-creation-default-error', 'Failed to create connection')
        );
      }
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
