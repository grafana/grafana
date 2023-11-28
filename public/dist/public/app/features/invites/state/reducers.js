import { createEntityAdapter, createSlice } from '@reduxjs/toolkit';
import { fetchInvitees, revokeInvite } from './actions';
const invitesAdapter = createEntityAdapter({ selectId: (invite) => invite.code });
export const selectors = invitesAdapter.getSelectors();
export const initialState = invitesAdapter.getInitialState({ status: 'idle' });
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
//# sourceMappingURL=reducers.js.map