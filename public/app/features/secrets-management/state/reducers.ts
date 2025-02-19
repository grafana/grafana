// Contents of this file may very well be moved to the admin reducers file in the future.

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { Secret, SecretRequestIdentifier, SecretsListResponseItem } from '../types';
import { transformToSecret } from '../utils';

interface SecretsManagementAdminState {
  isLoading: boolean;
  secrets: Secret[];
  queued: {
    delete: SecretRequestIdentifier[];
    create: SecretsListResponseItem[];
    update: SecretsListResponseItem[];
  };
}

const initialSecretsManagementAdminState: SecretsManagementAdminState = {
  isLoading: false,
  secrets: [],
  queued: {
    delete: [],
    create: [],
    update: [],
  },
};

export const secretsManagementAdminSlice = createSlice({
  name: 'secretsManagementAdmin',
  initialState: initialSecretsManagementAdminState,
  reducers: {
    secretsFetchBegin: (state) => {
      state.isLoading = true;
    },
    secretsFetchSuccess: (state, action) => {
      state.isLoading = false;
      state.secrets = action.payload;
    },
    fetchSecretsFailure: (state) => {
      state.isLoading = false;
    },
    deleteSecretBegin: () => {},
    deleteSecretSuccess: (state, action: PayloadAction<SecretRequestIdentifier>) => {
      state.secrets = state.secrets.filter((secret) => secret.name !== action.payload);
    },
    deleteSecretFailure: (_state, action: PayloadAction<unknown>) => {
      console.error('unable to remove secret', action.payload);
    },
    createSecretBegin: () => {},
    createSecretSuccess: (state, action: PayloadAction<SecretsListResponseItem>) => {
      const newSecret = transformToSecret(action.payload);
      state.secrets.push(newSecret);
    },
    createSecretFailure: () => {},
    updateSecretBegin: () => {},
    updateSecretSuccess: (state, action: PayloadAction<SecretsListResponseItem>) => {
      state.secrets = state.secrets.map((secret) => {
        if (secret.name === action.payload.metadata.name) {
          return transformToSecret(action.payload);
        }
        return secret;
      });
    },
    updateSecretFailure: () => {},
  },
});

export const secretsManagementAdminReducer = secretsManagementAdminSlice.reducer;

export const {
  secretsFetchBegin,
  secretsFetchSuccess,
  fetchSecretsFailure,
  deleteSecretBegin,
  deleteSecretSuccess,
  deleteSecretFailure,
  createSecretBegin,
  createSecretSuccess,
  createSecretFailure,
  updateSecretBegin,
  updateSecretSuccess,
  updateSecretFailure,
} = secretsManagementAdminSlice.actions;
