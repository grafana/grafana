import { __awaiter } from "tslib";
import { createSlice } from '@reduxjs/toolkit';
import { withSerializedError } from 'app/features/alerting/unified/utils/redux';
import RolesService from 'app/percona/shared/services/roles/Roles.service';
import { createAsyncThunk } from 'app/types';
const initialState = {
    isLoading: false,
    roles: [],
};
export const rolesSlice = createSlice({
    name: 'roles',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder.addCase(fetchRolesAction.pending, (state) => (Object.assign(Object.assign({}, state), { isLoading: true })));
        builder.addCase(fetchRolesAction.rejected, (state) => (Object.assign(Object.assign({}, state), { isLoading: false })));
        builder.addCase(fetchRolesAction.fulfilled, (state, action) => (Object.assign(Object.assign({}, state), { isLoading: false, roles: action.payload })));
    },
});
export const fetchRolesAction = createAsyncThunk('percona/fetchRoles', () => withSerializedError(RolesService.list()));
export const fetchRoleAction = createAsyncThunk('percona/fetchRole', (roleId) => __awaiter(void 0, void 0, void 0, function* () { return withSerializedError(RolesService.get(roleId)); }));
export const createRoleAction = createAsyncThunk('percona/createRole', (role, thunkAPI) => __awaiter(void 0, void 0, void 0, function* () {
    return withSerializedError((() => __awaiter(void 0, void 0, void 0, function* () {
        yield RolesService.create(role);
        thunkAPI.dispatch(fetchRolesAction());
    }))());
}));
export const updateRoleAction = createAsyncThunk('percona/updateRole', (role, thunkAPI) => __awaiter(void 0, void 0, void 0, function* () {
    return withSerializedError((() => __awaiter(void 0, void 0, void 0, function* () {
        yield RolesService.update(role);
        thunkAPI.dispatch(fetchRolesAction());
    }))());
}));
export const deleteRoleAction = createAsyncThunk('percona/deleteRole', (role, thunkAPI) => __awaiter(void 0, void 0, void 0, function* () {
    return withSerializedError((() => __awaiter(void 0, void 0, void 0, function* () {
        yield RolesService.delete(role);
        thunkAPI.dispatch(fetchRolesAction());
    }))());
}));
export const setAsDefaultRoleAction = createAsyncThunk('percona/setAsDefaultRole', (roleId, thunkAPI) => __awaiter(void 0, void 0, void 0, function* () {
    return withSerializedError((() => __awaiter(void 0, void 0, void 0, function* () {
        yield RolesService.setDefault(roleId);
        thunkAPI.dispatch(fetchRolesAction());
    }))());
}));
export const assignRoleAction = createAsyncThunk('percona/assignRole', ({ roleIds, userId }) => __awaiter(void 0, void 0, void 0, function* () {
    return withSerializedError((() => __awaiter(void 0, void 0, void 0, function* () {
        yield RolesService.assign(roleIds, userId);
    }))());
}));
export default rolesSlice.reducer;
//# sourceMappingURL=roles.js.map