import { ThunkResult } from 'app/types';

import { createSecretRequest, deleteSecretRequest, getSecretsList, updateSecretRequest } from '../api';
import { NewSecret, Secret, SecretRequestIdentifier } from '../types';

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
  updateSecretBegin,
  updateSecretSuccess,
  updateSecretFailure,
} from './reducers';

export function fetchSecrets(): ThunkResult<void> {
  return async (dispatch) => {
    try {
      dispatch(secretsFetchBegin());
      const secrets = await getSecretsList();
      dispatch(secretsFetchSuccess(secrets));
    } catch (error: unknown) {
      dispatch(fetchSecretsFailure());
    }
  };
}

export function deleteSecret(id: SecretRequestIdentifier): ThunkResult<Promise<boolean>> {
  return async (dispatch) => {
    try {
      dispatch(deleteSecretBegin());
      await deleteSecretRequest(id);
      dispatch(deleteSecretSuccess(id));
      // dispatch(fetchSecrets());
      return Promise.resolve(true);
    } catch (error: unknown) {
      dispatch(deleteSecretFailure(error));
      return Promise.reject(false);
    }
  };
}

export function createSecret(data: NewSecret): ThunkResult<Promise<void>> {
  return async (dispatch) => {
    try {
      dispatch(createSecretBegin());
      const response = await createSecretRequest(data);
      dispatch(createSecretSuccess(response.data));
      // dispatch(fetchSecrets());

      return Promise.resolve();
    } catch (error: unknown) {
      dispatch(createSecretFailure());
      return Promise.reject(error);
    }
  };
}

export function updateSecret(data: Secret): ThunkResult<Promise<void>> {
  return async (dispatch) => {
    try {
      dispatch(updateSecretBegin());
      const response = await updateSecretRequest(data);
      dispatch(updateSecretSuccess(response.data));
      // dispatch(fetchSecrets());

      return Promise.resolve();
    } catch (error: unknown) {
      dispatch(updateSecretFailure());
      return Promise.reject(error);
    }
  };
}

export function storeSecret(data: Secret | NewSecret): ThunkResult<Promise<void>> {
  return async (dispatch) => {
    if (!data.uid) {
      await dispatch(createSecret(data as NewSecret));
    } else {
      await dispatch(updateSecret(data as Secret));
    }
  };
}
