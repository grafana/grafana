import { useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { Trans, t } from '@grafana/i18n';
import { isFetchError } from '@grafana/runtime';
import { Alert, Button, LoadingPlaceholder, Stack } from '@grafana/ui';
import { type ConnectionSpec } from 'app/api/clients/provisioning/v0alpha1';
import { extractErrorMessage } from 'app/api/utils';

import { OAuthConnectionFields } from '../components/Shared/OAuthConnectionFields';
import { WebhookDisabledField } from '../components/Shared/WebhookDisabledField';
import { useCreateOrUpdateConnection } from '../hooks/useCreateOrUpdateConnection';
import { type ConnectionFormData, type OAuthConnectionType } from '../types';
import { buildOAuthAuthorizeUrl, onOAuthAuthorizationComplete } from '../utils/connectionOAuth';
import { getConnectionFormErrors } from '../utils/getFormErrors';

interface NewOAuthConnectionFieldsProps {
  type: OAuthConnectionType;
  onAuthorized: (connectionName: string) => void;
}

export function NewOAuthConnectionFields({ type, onAuthorized }: NewOAuthConnectionFieldsProps) {
  const credentialForm = useForm<ConnectionFormData>({
    defaultValues: {
      type,
      title: '',
      description: '',
      clientID: '',
      clientSecret: '',
      workspace: '',
      serverUrl: '',
      webhookDisabled: false,
    },
  });
  const [createConnection, request] = useCreateOrUpdateConnection();
  const [submitError, setSubmitError] = useState<string>();
  const [pendingName, setPendingName] = useState<string>();

  useEffect(() => {
    if (!pendingName) {
      return;
    }
    return onOAuthAuthorizationComplete((name) => {
      if (name === pendingName) {
        onAuthorized(name);
      }
    });
  }, [pendingName, onAuthorized]);

  const handleCreate = async () => {
    setSubmitError(undefined);
    // Open the tab synchronously so popup blockers allow it; navigate it once
    // the connection exists.
    const authTab = window.open('', '_blank');

    if (!(await credentialForm.trigger())) {
      authTab?.close();
      return;
    }

    const form = credentialForm.getValues();
    const spec: ConnectionSpec = {
      title: form.title,
      type,
      ...(form.description && { description: form.description }),
      ...(form.webhookDisabled ? { webhook: { disabled: true } } : {}),
      ...(type === 'gitlab'
        ? { gitlab: { clientID: form.clientID ?? '' } }
        : type === 'githubOAuth'
          ? { githubOAuth: { clientID: form.clientID ?? '' } }
          : type === 'githubEnterpriseOAuth'
            ? { githubEnterpriseOAuth: { clientID: form.clientID ?? '', serverUrl: form.serverUrl ?? '' } }
            : { bitbucket: { clientID: form.clientID ?? '', workspace: form.workspace ?? '' } }),
    };

    const handleFormErrors = (error: unknown): boolean => {
      if (isFetchError(error)) {
        const formErrors = getConnectionFormErrors(error.data);
        if (formErrors.length > 0) {
          for (const [field, errorMessage] of formErrors) {
            credentialForm.setError(field, errorMessage);
          }
          return true;
        }
      }
      return false;
    };

    try {
      const result = await createConnection(spec, undefined, form.clientSecret);
      const name = result.data?.metadata?.name;
      if (name && form.clientID) {
        const url = buildOAuthAuthorizeUrl(type, form.clientID, name, form.serverUrl, { popup: true });
        if (authTab) {
          authTab.location.href = url;
        } else {
          window.open(url, '_blank');
        }
        setPendingName(name);
        return;
      }
      authTab?.close();
      if (result.error && !handleFormErrors(result.error)) {
        setSubmitError(extractErrorMessage(result.error));
      }
    } catch (error) {
      authTab?.close();
      if (!handleFormErrors(error)) {
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
          <Button variant="secondary" onClick={() => setPendingName(undefined)}>
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
