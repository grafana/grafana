export { BASE_URL } from './baseAPI';
import { generatedAPI as rawAPI } from './endpoints.gen';

export * from './endpoints.gen';
export const generatedAPI = rawAPI.enhanceEndpoints({});
