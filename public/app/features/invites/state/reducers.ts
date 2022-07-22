import { createEntityAdapter, createSlice } from '@reduxjs/toolkit';

import { Invitee } from 'app/types';

import { fetchInvitees, revokeInvite } from './actions';

export type Status = 'idle' | 'loading' | 'succeeded' | 'failed';

const invitesAdapter = createEntityAdapter({ selectId: (invite: Invitee) => invite.code });
export const selectors = invitesAdapter.getSelectors();
export const initialState = invitesAdapter.getInitialState<{ status: Status }>({ status: 'idle' });

const invitesSlice = createSlice({
  name: 'invites',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchInvitees.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchInvitees.fulfilled, (state, { payload: invites }) => {
        invitesAdapter.setAll(state, invites);
        state.status = 'succeeded';
      })
      .addCase(fetchInvitees.rejected, (state) => {
        state.status = 'failed';
      })
      .addCase(revokeInvite.fulfilled, (state, { payload: inviteCode }) => {
        invitesAdapter.removeOne(state, inviteCode);
        state.status = 'succeeded';
      });
  },
});

export const invitesReducer = invitesSlice.reducer;

export default {
  invites: invitesReducer,
};
