import { generatedAPI as rawAPI } from './endpoints';

export * from './endpoints';
export const generatedAPI = rawAPI.enhanceEndpoints({});
