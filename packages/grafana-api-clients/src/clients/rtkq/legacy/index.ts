import { generatedAPI as rawAPI } from './endpoints.gen';

export const legacyAPI = rawAPI.enhanceEndpoints({});

export * from './endpoints.gen';
