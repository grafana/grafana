import { __awaiter } from "tslib";
import { of } from 'rxjs';
import { DataSourceWithBackend } from '@grafana/runtime';
export class ParcaDataSource extends DataSourceWithBackend {
    constructor(instanceSettings) {
        super(instanceSettings);
    }
    query(request) {
        if (!request.targets.every((q) => q.profileTypeId)) {
            // When changing data source in explore, firs query can be sent without filled in profileTypeId
            return of({ data: [] });
        }
        return super.query(request);
    }
    getProfileTypes() {
        const _super = Object.create(null, {
            getResource: { get: () => super.getResource }
        });
        return __awaiter(this, void 0, void 0, function* () {
            return yield _super.getResource.call(this, 'profileTypes');
        });
    }
    getLabelNames() {
        const _super = Object.create(null, {
            getResource: { get: () => super.getResource }
        });
        return __awaiter(this, void 0, void 0, function* () {
            return yield _super.getResource.call(this, 'labelNames');
        });
    }
    getLabelValues(labelName) {
        const _super = Object.create(null, {
            getResource: { get: () => super.getResource }
        });
        return __awaiter(this, void 0, void 0, function* () {
            return yield _super.getResource.call(this, 'labelValues', { label: labelName });
        });
    }
}
//# sourceMappingURL=datasource.js.map