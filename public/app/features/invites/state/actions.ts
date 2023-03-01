import { getBackendSrv } from '@grafana/runtime';
import { contextSrv } from 'app/core/core';
import { FormModel } from 'app/features/org/UserInviteForm';
import { AccessControlAction, createAsyncThunk, Invitee } from 'app/types';

export const fetchInvitees = createAsyncThunk('users/fetchInvitees', async () => {
  if (!contextSrv.hasPermission(AccessControlAction.OrgUsersAdd)) {
    return [];
  }

  const invitees: Invitee[] = await getBackendSrv().get('/api/org/invites');
  return invitees;
});

export const addInvitee = createAsyncThunk('users/addInvitee', async (addInviteForm: FormModel, { dispatch }) => {
  await getBackendSrv().post(`/api/org/invites`, addInviteForm);
  await dispatch(fetchInvitees());
});

export const revokeInvite = createAsyncThunk('users/revokeInvite', async (code: string) => {
  await getBackendSrv().patch(`/api/org/invites/${code}/revoke`, {});
  return code;
});
