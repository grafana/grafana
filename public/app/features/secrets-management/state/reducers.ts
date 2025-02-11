// Contents of this file may very well be moved to the admin reducers file in the future.

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { Secret, SecretRequestIdentifier } from '../types';

interface SecretsManagementAdminState {
  isLoading: boolean;
  secrets: Secret[];
}

const initialSecretsManagementAdminState: SecretsManagementAdminState = {
  isLoading: false,
  secrets: [],
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
    fetchSecretsFailure: (state, action) => {
      state.isLoading = false;
      console.error('Unable to load secrets.', action);
    },
    deleteSecretBegin: (state, action: PayloadAction<SecretRequestIdentifier>) => {
      console.warn('Deleting secret', action.payload);
      state.isLoading = true;
    },
    deleteSecretSuccess: (state, action: PayloadAction<SecretRequestIdentifier>) => {
      console.warn('Secret deleted', action.payload);
    },
    deleteSecretFailure: (state, action) => {
      state.isLoading = false;
      console.error('Unable to delete secrets.', action);
    },
    createSecretBegin: (state) => {
      state.isLoading = true;
    },
    createSecretSuccess: (state) => {
      state.isLoading = false;
    },
    createSecretFailure: (state, action) => {
      state.isLoading = false;
      console.error('Unable to create secret.', action);
    },
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
} = secretsManagementAdminSlice.actions;
