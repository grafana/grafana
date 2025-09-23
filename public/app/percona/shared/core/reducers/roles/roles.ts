import { createSlice } from '@reduxjs/toolkit';

import { withSerializedError } from 'app/features/alerting/unified/utils/redux';
import RolesService from 'app/percona/shared/services/roles/Roles.service';
import {
  AccessRole,
  CreateAccessRole,
  DeleteAccessRole,
  UpdateAccessRole,
} from 'app/percona/shared/services/roles/Roles.types';
import { createAsyncThunk } from 'app/types';

import { AssignRoleParams, RolesState } from './role.types';

const initialState: RolesState = {
  isLoading: false,
  roles: [],
};

export const rolesSlice = createSlice({
  name: 'roles',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(fetchRolesAction.pending, (state) => ({
      ...state,
      isLoading: true,
    }));

    builder.addCase(fetchRolesAction.rejected, (state) => ({
      ...state,
      isLoading: false,
    }));

    builder.addCase(fetchRolesAction.fulfilled, (state, action) => ({
      ...state,
      isLoading: false,
      roles: action.payload,
    }));
  },
});

export const fetchRolesAction = createAsyncThunk<AccessRole[]>('percona/fetchRoles', () =>
  withSerializedError(RolesService.list())
);

export const fetchRoleAction = createAsyncThunk(
  'percona/fetchRole',
  async (roleId: number): Promise<AccessRole> => withSerializedError(RolesService.get(roleId))
);

export const createRoleAction = createAsyncThunk('percona/createRole', async (role: CreateAccessRole, thunkAPI) =>
  withSerializedError(
    (async () => {
      await RolesService.create(role);
      thunkAPI.dispatch(fetchRolesAction());
    })()
  )
);

export const updateRoleAction = createAsyncThunk(
  'percona/updateRole',
  async (role: UpdateAccessRole, thunkAPI): Promise<void> =>
    withSerializedError(
      (async () => {
        await RolesService.update(role);
        thunkAPI.dispatch(fetchRolesAction());
      })()
    )
);

export const deleteRoleAction = createAsyncThunk(
  'percona/deleteRole',
  async (role: DeleteAccessRole, thunkAPI): Promise<void> =>
    withSerializedError(
      (async () => {
        await RolesService.delete(role);
        thunkAPI.dispatch(fetchRolesAction());
      })()
    )
);

export const setAsDefaultRoleAction = createAsyncThunk(
  'percona/setAsDefaultRole',
  async (roleId: number, thunkAPI): Promise<void> =>
    withSerializedError(
      (async () => {
        await RolesService.setDefault(roleId);
        thunkAPI.dispatch(fetchRolesAction());
      })()
    )
);

export const assignRoleAction = createAsyncThunk('percona/assignRole', async ({ roleIds, userId }: AssignRoleParams) =>
  withSerializedError(
    (async () => {
      await RolesService.assign(roleIds, userId);
    })()
  )
);

export default rolesSlice.reducer;
