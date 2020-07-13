import { LocationState } from 'app/types';

export const getRouteParamsId = (state: LocationState) => state.routeParams.id;
export const getRouteParamsPage = (state: LocationState) => state.routeParams.page;
export const getRouteParams = (state: LocationState) => state.routeParams;
export const getLocationQuery = (state: LocationState) => state.query;
export const getUrl = (state: LocationState) => state.url;
