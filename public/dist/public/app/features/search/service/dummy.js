import { __awaiter } from "tslib";
import { DataFrameView } from '@grafana/data';
// This is a dummy search useful for tests
export class DummySearcher {
    constructor() {
        this.expectedSortResponse = [];
        this.expectedTagsResponse = [];
    }
    setExpectedSearchResult(result) {
        this.expectedSearchResponse = {
            view: new DataFrameView(result),
            isItemLoaded: () => true,
            loadMoreItems: () => Promise.resolve(),
            totalRows: result.length,
        };
    }
    search(query) {
        return __awaiter(this, void 0, void 0, function* () {
            return Promise.resolve(this.expectedSearchResponse);
        });
    }
    starred(query) {
        return __awaiter(this, void 0, void 0, function* () {
            return Promise.resolve(this.expectedStarsResponse);
        });
    }
    getSortOptions() {
        return __awaiter(this, void 0, void 0, function* () {
            return Promise.resolve(this.expectedSortResponse);
        });
    }
    tags(query) {
        return __awaiter(this, void 0, void 0, function* () {
            return Promise.resolve(this.expectedTagsResponse);
        });
    }
    getFolderViewSort() {
        return '';
    }
}
//# sourceMappingURL=dummy.js.map