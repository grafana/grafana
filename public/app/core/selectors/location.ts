import { LocationState } from 'app/types';

export const getRouteParamsId = (state: LocationState) => state.routeParams.id;
export const getRouteParamsPage = (state: LocationState) => state.routeParams.page;
export const getRouteParams = (state: LocationState) => state.routeParams;
