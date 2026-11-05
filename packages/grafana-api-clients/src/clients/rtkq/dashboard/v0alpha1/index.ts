export { BASE_URL, API_GROUP, API_VERSION } from './baseAPI';
export { API_RESOURCES } from './resources.gen';
import { addTagTypes, generatedAPI as rawAPI } from './endpoints.gen';

export * from './endpoints.gen';
export const generatedAPI = rawAPI.enhanceEndpoints({
  addTagTypes: [...addTagTypes, 'Folder', 'Dashboard'],
});
