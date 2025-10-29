import { generatedAPI as rawAPI, SearchTeamsApiArg } from './endpoints.gen';

export const legacyAPI = rawAPI.enhanceEndpoints({});

export * from './endpoints.gen';
