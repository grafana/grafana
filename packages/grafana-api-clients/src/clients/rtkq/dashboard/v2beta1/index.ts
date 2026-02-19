export { BASE_URL, API_GROUP, API_VERSION } from './baseAPI';
import { addTagTypes, generatedAPI as rawAPI } from './endpoints.gen';

export * from './endpoints.gen';
export const generatedAPI = rawAPI.enhanceEndpoints({
  addTagTypes: [...addTagTypes, 'Folder', 'Dashboard'],
});
