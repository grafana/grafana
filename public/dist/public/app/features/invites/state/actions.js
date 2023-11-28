import { __awaiter } from "tslib";
import { getBackendSrv } from '@grafana/runtime';
import { contextSrv } from 'app/core/core';
import { AccessControlAction, createAsyncThunk } from 'app/types';
export const fetchInvitees = createAsyncThunk('users/fetchInvitees', () => __awaiter(void 0, void 0, void 0, function* () {
    if (!contextSrv.hasPermission(AccessControlAction.OrgUsersAdd)) {
        return [];
    }
    const invitees = yield getBackendSrv().get('/api/org/invites');
    return invitees;
}));
export const addInvitee = createAsyncThunk('users/addInvitee', (addInviteForm, { dispatch }) => __awaiter(void 0, void 0, void 0, function* () {
    yield getBackendSrv().post(`/api/org/invites`, addInviteForm);
    yield dispatch(fetchInvitees());
}));
export const revokeInvite = createAsyncThunk('users/revokeInvite', (code) => __awaiter(void 0, void 0, void 0, function* () {
    yield getBackendSrv().patch(`/api/org/invites/${code}/revoke`, {});
    return code;
}));
//# sourceMappingURL=actions.js.map