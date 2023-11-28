import { __awaiter } from "tslib";
import uFuzzy from '@leeoniya/ufuzzy';
import { DataFrameView } from '@grafana/data';
export class FrontendSearcher {
    constructor(parent) {
        this.parent = parent;
        this.cache = new Map();
        this.sortPlaceholder = 'Default (Relevance)';
    }
    search(query) {
        var _a, _b, _c;
        return __awaiter(this, void 0, void 0, function* () {
            if ((_a = query.facet) === null || _a === void 0 ? void 0 : _a.length) {
                throw new Error('facets not supported!');
            }
            // we don't yet support anything except default (relevance)
            if (query.sort != null) {
                throw new Error('custom sorting is not supported yet');
            }
            // Don't bother... not needed for this exercise
            if (((_b = query.tags) === null || _b === void 0 ? void 0 : _b.length) || ((_c = query.ds_uid) === null || _c === void 0 ? void 0 : _c.length)) {
                return this.parent.search(query);
            }
            // TODO -- make sure we refresh after a while
            const all = yield this.getCache(query.kind);
            const view = all.search(query.query);
            return {
                isItemLoaded: () => true,
                loadMoreItems: (startIndex, stopIndex) => __awaiter(this, void 0, void 0, function* () { }),
                totalRows: view.length,
                view,
            };
        });
    }
    getCache(kind) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = kind ? kind.sort().join(',') : '*';
            const cacheHit = this.cache.get(key);
            if (cacheHit) {
                try {
                    return yield cacheHit;
                }
                catch (e) {
                    // delete the cache key so that the next request will retry
                    this.cache.delete(key);
                    return new FullResultCache(new DataFrameView({ name: 'error', fields: [], length: 0 }));
                }
            }
            const resultPromise = this.parent
                .search({
                kind,
                limit: 5000, // max for now
            })
                .then((res) => new FullResultCache(res.view));
            this.cache.set(key, resultPromise);
            return resultPromise;
        });
    }
    starred(query) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.parent.starred(query);
        });
    }
    // returns the appropriate sorting options
    getSortOptions() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.parent.getSortOptions();
        });
    }
    tags(query) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.parent.tags(query);
        });
    }
    getFolderViewSort() {
        return this.parent.getFolderViewSort();
    }
}
class FullResultCache {
    constructor(full) {
        this.full = full;
        this.ufuzzy = new uFuzzy({
            intraMode: 1,
            intraIns: 1,
            intraSub: 1,
            intraTrn: 1,
            intraDel: 1,
        });
        this.names = this.full.fields.name.values;
        // Copy with empty values
        this.empty = new DataFrameView(Object.assign(Object.assign({}, this.full.dataFrame), { fields: this.full.dataFrame.fields.map((v) => (Object.assign(Object.assign({}, v), { values: [] }))), length: 0 }));
    }
    // single instance that is mutated for each response (not great, but OK for now)
    search(query) {
        if (!(query === null || query === void 0 ? void 0 : query.length) || query === '*') {
            return this.full;
        }
        const allFields = this.full.dataFrame.fields;
        const haystack = this.names;
        // eslint-disable-next-line
        const values = allFields.map((v) => []); // empty value for each field
        let [idxs, info, order] = this.ufuzzy.search(haystack, query, true);
        for (let c = 0; c < allFields.length; c++) {
            let src = allFields[c].values;
            let dst = values[c];
            // <= 1000 matches (ranked)
            if (info && order) {
                for (let i = 0; i < order.length; i++) {
                    let haystackIdx = info.idx[order[i]];
                    dst.push(src[haystackIdx]);
                }
            }
            // > 1000 matches (unranked)
            else if (idxs) {
                for (let i = 0; i < idxs.length; i++) {
                    let haystackIdx = idxs[i];
                    dst.push(src[haystackIdx]);
                }
            }
        }
        // mutates the search object
        this.empty.dataFrame.fields.forEach((f, idx) => {
            f.values = values[idx]; // or just set it?
        });
        this.empty.dataFrame.length = this.empty.dataFrame.fields[0].values.length;
        return this.empty;
    }
}
//# sourceMappingURL=frontend.js.map