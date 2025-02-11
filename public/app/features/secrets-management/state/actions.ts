import { ThunkResult } from 'app/types';

import { createSecretRequest, deleteSecretRequest, getSecretsList } from '../api';
import { Secret, SecretRequestIdentifier } from '../types';

import {
  secretsFetchBegin,
  secretsFetchSuccess,
  fetchSecretsFailure,
  deleteSecretBegin,
  deleteSecretFailure,
  createSecretBegin,
  createSecretSuccess,
  createSecretFailure,
  deleteSecretSuccess,
} from './reducers';

export function fetchSecrets(): ThunkResult<void> {
  return async (dispatch, getState) => {
    try {
      dispatch(secretsFetchBegin());
      const secrets = await getSecretsList();
      dispatch(secretsFetchSuccess(secrets));
    } catch (error: unknown) {
      dispatch(fetchSecretsFailure(error));
    }
  };
}

export function deleteSecret(id: SecretRequestIdentifier): ThunkResult<void> {
  return async (dispatch) => {
    try {
      dispatch(deleteSecretBegin(id));
      await deleteSecretRequest(id);
      dispatch(fetchSecrets());
      dispatch(deleteSecretSuccess(id));
    } catch (error: unknown) {
      dispatch(deleteSecretFailure(error));
    }
  };
}

export function createSecret(data: Partial<Secret> & { value?: string }): ThunkResult<Promise<void>> {
  return async (dispatch) => {
    try {
      dispatch(createSecretBegin());
      await createSecretRequest(data);
      dispatch(fetchSecrets());
      dispatch(createSecretSuccess());

      return Promise.resolve();
    } catch (error: unknown) {
      dispatch(createSecretFailure(error));
      return Promise.reject(error);
    }
  };
}
