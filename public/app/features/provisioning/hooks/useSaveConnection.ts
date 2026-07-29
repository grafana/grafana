import { useState } from 'react';
import { type UseFormSetError } from 'react-hook-form';

import { isFetchError } from '@grafana/runtime';
import { extractErrorMessage } from 'app/api/utils';

import { type ConnectionFormData } from '../types';
import { connectionSpecFromForm } from '../utils/connectionData';
import { isOAuthConnectionType } from '../utils/connectionOAuth';
import { extractFormErrors, setConnectionFormErrors } from '../utils/getFormErrors';

import { useInvalidateConnectionList } from './useConnectionList';
import { useCreateOrUpdateConnection } from './useCreateOrUpdateConnection';
import { useOAuthAuthorization } from './useOAuthAuthorization';

export type SaveConnectionResult =
  | { status: 'saved' | 'authorizing'; name: string }
  | { status: 'error'; fieldErrors: boolean; message?: string };

interface SaveConnectionArgs {
  form: ConnectionFormData;
  /** Run the OAuth authorization round-trip after saving */
  authorize: boolean;
  setError: UseFormSetError<ConnectionFormData>;
  /** Validation to run after the authorization tab is opened, so popup blockers allow it */
  validate?: () => Promise<boolean>;
}

// Saves a connection and optionally runs the OAuth authorization round-trip.
// The first successful create binds follow-up saves to the created connection,
// so saving again while authorization is pending updates it instead of
// creating a duplicate. `onAuthorized` fires when the authorization completes;
// authorization errors surface through `submitError`.
export function useSaveConnection(onAuthorized: (connectionName: string) => void, existingName?: string) {
  const [createdName, setCreatedName] = useState<string>();
  const connectionName = existingName ?? createdName;
  const [submitData, request] = useCreateOrUpdateConnection(connectionName);
  const [submitError, setSubmitError] = useState<string>();
  const invalidateConnectionList = useInvalidateConnectionList();

  const { openTab, closeTab, authorize, cancel, isPending } = useOAuthAuthorization((name, error) => {
    if (error) {
      setSubmitError(error);
      return;
    }
    setSubmitError(undefined);
    invalidateConnectionList();
    onAuthorized(name);
  });

  const save = async ({
    form,
    authorize: shouldAuthorize,
    setError,
    validate,
  }: SaveConnectionArgs): Promise<SaveConnectionResult> => {
    setSubmitError(undefined);
    cancel();

    if (shouldAuthorize) {
      openTab();
    }
    if (validate && !(await validate())) {
      closeTab();
      return { status: 'error', fieldErrors: true };
    }

    const isOAuth = isOAuthConnectionType(form.type);
    try {
      const result = await submitData(
        connectionSpecFromForm(form),
        isOAuth ? undefined : form.privateKey,
        isOAuth ? form.clientSecret : undefined
      );
      const name = connectionName ?? result.data?.metadata?.name;
      if (result.error || !name) {
        closeTab();
        return errorResult(result.error, setError);
      }
      if (!connectionName) {
        setCreatedName(name);
      }

      if (shouldAuthorize && form.clientID && isOAuthConnectionType(form.type)) {
        authorize({ type: form.type, clientID: form.clientID, name, serverUrl: form.serverUrl });
        return { status: 'authorizing', name };
      }
      closeTab();
      return { status: 'saved', name };
    } catch (error) {
      closeTab();
      return errorResult(error, setError);
    }
  };

  return { save, request, submitError, setSubmitError, isAuthorizing: isPending };
}

function errorResult(error: unknown, setError: UseFormSetError<ConnectionFormData>): SaveConnectionResult {
  if (setConnectionFormErrors(error, setError)) {
    return { status: 'error', fieldErrors: true };
  }
  if (isFetchError(error)) {
    const detail = extractFormErrors(error.data).find((e) => e.detail)?.detail;
    if (detail) {
      return { status: 'error', fieldErrors: false, message: detail };
    }
  }
  return { status: 'error', fieldErrors: false, message: extractErrorMessage(error) };
}
