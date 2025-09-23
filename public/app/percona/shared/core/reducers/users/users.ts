import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import { withSerializedError } from 'app/features/alerting/unified/utils/redux';
import { UserService } from 'app/percona/shared/services/user/User.service';

import { UserItem, UsersState } from './users.types';
import { toMap, toUserItem } from './users.utils';

const initialState: UsersState = {
  isLoading: false,
  users: [],
  usersMap: {},
};

const usersSlice = createSlice({
  name: 'users',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(fetchUsersListAction.pending, (state) => ({
      ...state,
      isLoading: true,
    }));

    builder.addCase(fetchUsersListAction.rejected, (state) => ({
      ...state,
      isLoading: false,
    }));

    builder.addCase(fetchUsersListAction.fulfilled, (state, action) => ({
      ...state,
      users: action.payload,
      usersMap: toMap(action.payload),
      isLoading: false,
    }));
  },
});

export const fetchUsersListAction = createAsyncThunk<UserItem[]>('percona/fetchUsersList', async () =>
  withSerializedError(
    (async () => {
      const res = await UserService.getUsersList();
      return res.users.map(toUserItem);
    })()
  )
);

export default usersSlice.reducer;
