import { backendSrv } from './backend_srv';
export class PreferencesService {
    constructor(resourceUri) {
        this.resourceUri = resourceUri;
    }
    /**
     * Overrides all preferences
     */
    update(preferences) {
        return backendSrv.put(`/api/${this.resourceUri}/preferences`, preferences);
    }
    /**
     * Updates only provided preferences
     */
    patch(preferences) {
        return backendSrv.patch(`/api/${this.resourceUri}/preferences`, preferences);
    }
    load() {
        return backendSrv.get(`/api/${this.resourceUri}/preferences`);
    }
}
//# sourceMappingURL=PreferencesService.js.map