import { type UserState } from './reducers';

export const getTimeZone = (state: UserState) => state.timeZone;
export const getFiscalYearStartMonth = (state: UserState) => state.fiscalYearStartMonth;
