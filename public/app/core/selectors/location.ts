import { LocationState } from 'app/types';

export const getRouteParamsId = (state: LocationState) => state.routeParams.id;
export const getRouteParamsPage = (state: LocationState) => state.routeParams.page;
export const getRouteParamsLogin = (state: LocationState) => state.routeParams.login;
