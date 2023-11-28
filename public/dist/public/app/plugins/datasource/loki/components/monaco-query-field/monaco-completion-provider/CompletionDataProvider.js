import { __awaiter } from "tslib";
import { chain } from 'lodash';
import { escapeLabelValueInExactSelector } from 'app/plugins/datasource/prometheus/language_utils';
export class CompletionDataProvider {
    constructor(languageProvider, historyRef = { current: [] }) {
        this.languageProvider = languageProvider;
        this.historyRef = historyRef;
        this.queryToLabelKeysCache = new Map();
    }
    buildSelector(labels) {
        const allLabelTexts = labels.map((label) => `${label.name}${label.op}"${escapeLabelValueInExactSelector(label.value)}"`);
        return `{${allLabelTexts.join(',')}}`;
    }
    getHistory() {
        return chain(this.historyRef.current)
            .map((history) => history.query.expr)
            .filter()
            .uniq()
            .value();
    }
    getLabelNames(otherLabels = []) {
        return __awaiter(this, void 0, void 0, function* () {
            if (otherLabels.length === 0) {
                // if there is no filtering, we have to use a special endpoint
                return this.languageProvider.getLabelKeys();
            }
            const data = yield this.getSeriesLabels(otherLabels);
            const possibleLabelNames = Object.keys(data); // all names from datasource
            const usedLabelNames = new Set(otherLabels.map((l) => l.name)); // names used in the query
            return possibleLabelNames.filter((label) => !usedLabelNames.has(label));
        });
    }
    getLabelValues(labelName, otherLabels) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            if (otherLabels.length === 0) {
                // if there is no filtering, we have to use a special endpoint
                return yield this.languageProvider.getLabelValues(labelName);
            }
            const data = yield this.getSeriesLabels(otherLabels);
            return (_a = data[labelName]) !== null && _a !== void 0 ? _a : [];
        });
    }
    /**
     * Runs a Loki query to extract label keys from the result.
     * The result is cached for the query string.
     *
     * Since various "situations" in the monaco code editor trigger this function, it is prone to being called multiple times for the same query
     * Here is a lightweight and simple cache to avoid calling the backend multiple times for the same query.
     *
     * @param logQuery
     */
    getParserAndLabelKeys(logQuery) {
        return __awaiter(this, void 0, void 0, function* () {
            const EXTRACTED_LABEL_KEYS_MAX_CACHE_SIZE = 2;
            const cachedLabelKeys = this.queryToLabelKeysCache.has(logQuery) ? this.queryToLabelKeysCache.get(logQuery) : null;
            if (cachedLabelKeys) {
                // cache hit! Serve stale result from cache
                return cachedLabelKeys;
            }
            else {
                // If cache is larger than max size, delete the first (oldest) index
                if (this.queryToLabelKeysCache.size >= EXTRACTED_LABEL_KEYS_MAX_CACHE_SIZE) {
                    // Make room in the cache for the fresh result by deleting the "first" index
                    const keys = this.queryToLabelKeysCache.keys();
                    const firstKey = keys.next().value;
                    this.queryToLabelKeysCache.delete(firstKey);
                }
                // Fetch a fresh result from the backend
                const labelKeys = yield this.languageProvider.getParserAndLabelKeys(logQuery);
                // Add the result to the cache
                this.queryToLabelKeysCache.set(logQuery, labelKeys);
                return labelKeys;
            }
        });
    }
    getSeriesLabels(labels) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.languageProvider.getSeriesLabels(this.buildSelector(labels)).then((data) => data !== null && data !== void 0 ? data : {});
        });
    }
}
//# sourceMappingURL=CompletionDataProvider.js.map