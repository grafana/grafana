import { __awaiter } from "tslib";
import { getGrafanaSearcher } from 'app/features/search/service';
class ValidationError extends Error {
    constructor(type, message) {
        super(message);
        this.type = type;
    }
}
export class ValidationSrv {
    constructor() {
        this.rootName = 'general';
    }
    validateNewDashboardName(folderUID, name) {
        return this.validate(folderUID, name, 'A dashboard or a folder with the same name already exists');
    }
    validateNewFolderName(name) {
        return this.validate(this.rootName, name, 'A folder or dashboard in the general folder with the same name already exists');
    }
    validate(folderUID, name, existingErrorMessage) {
        return __awaiter(this, void 0, void 0, function* () {
            name = (name || '').trim();
            const nameLowerCased = name.toLowerCase();
            if (name.length === 0) {
                throw new ValidationError('REQUIRED', 'Name is required');
            }
            if (nameLowerCased === this.rootName) {
                throw new ValidationError('EXISTING', 'This is a reserved name and cannot be used for a folder.');
            }
            const searcher = getGrafanaSearcher();
            const dashboardResults = yield searcher.search({
                kind: ['dashboard'],
                query: name,
                location: folderUID || 'general',
            });
            for (const result of dashboardResults.view) {
                if (nameLowerCased === result.name.toLowerCase()) {
                    throw new ValidationError('EXISTING', existingErrorMessage);
                }
            }
            return;
        });
    }
}
export const validationSrv = new ValidationSrv();
//# sourceMappingURL=ValidationSrv.js.map