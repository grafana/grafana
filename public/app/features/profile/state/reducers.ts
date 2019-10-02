import { UserState } from 'app/types';
import config from 'app/core/config';

export const initialState: UserState = {
  orgId: config.bootData.user.orgId,
  timeZone: config.bootData.user.timezone,
};

export const userReducer = (state = initialState, action: any): UserState => {
  return state;
};

export default {
  user: userReducer,
};
