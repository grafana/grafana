import { __awaiter } from "tslib";
import { LanguageProvider } from '@grafana/data';
import { getAllTags, getTagsByScope, getUnscopedTags } from './SearchTraceQLEditor/utils';
import { TraceqlSearchScope } from './dataquery.gen';
export default class TempoLanguageProvider extends LanguageProvider {
    constructor(datasource, initialValues) {
        super();
        this.request = (url, params = {}) => __awaiter(this, void 0, void 0, function* () {
            const res = yield this.datasource.metadataRequest(url, params);
            return res === null || res === void 0 ? void 0 : res.data;
        });
        this.start = () => __awaiter(this, void 0, void 0, function* () {
            if (!this.startTask) {
                this.startTask = this.fetchTags().then(() => {
                    return [];
                });
            }
            return this.startTask;
        });
        this.setV1Tags = (tags) => {
            this.tagsV1 = tags;
        };
        this.setV2Tags = (tags) => {
            this.tagsV2 = tags;
        };
        this.getTags = (scope) => {
            if (this.tagsV2 && scope) {
                if (scope === TraceqlSearchScope.Unscoped) {
                    return getUnscopedTags(this.tagsV2);
                }
                return getTagsByScope(this.tagsV2, scope);
            }
            else if (this.tagsV1) {
                // This is needed because the /api/v2/search/tag/${tag}/values API expects "status" and the v1 API expects "status.code"
                // so Tempo doesn't send anything and we inject it here for the autocomplete
                if (!this.tagsV1.find((t) => t === 'status')) {
                    this.tagsV1.push('status');
                }
                return this.tagsV1;
            }
            return [];
        };
        this.getMetricsSummaryTags = (scope) => {
            if (this.tagsV2 && scope) {
                if (scope === TraceqlSearchScope.Unscoped) {
                    return getUnscopedTags(this.tagsV2);
                }
                return getTagsByScope(this.tagsV2, scope);
            }
            else if (this.tagsV1) {
                return this.tagsV1;
            }
            return [];
        };
        this.getTraceqlAutocompleteTags = (scope) => {
            if (this.tagsV2) {
                if (!scope) {
                    // have not typed a scope yet || unscoped (.) typed
                    return getUnscopedTags(this.tagsV2);
                }
                else if (scope === TraceqlSearchScope.Unscoped) {
                    return getUnscopedTags(this.tagsV2);
                }
                return getTagsByScope(this.tagsV2, scope);
            }
            else if (this.tagsV1) {
                // This is needed because the /api/v2/search/tag/${tag}/values API expects "status" and the v1 API expects "status.code"
                // so Tempo doesn't send anything and we inject it here for the autocomplete
                if (!this.tagsV1.find((t) => t === 'status')) {
                    this.tagsV1.push('status');
                }
                return this.tagsV1;
            }
            return [];
        };
        this.getAutocompleteTags = () => {
            if (this.tagsV2) {
                return getAllTags(this.tagsV2);
            }
            else if (this.tagsV1) {
                // This is needed because the /api/search/tag/${tag}/values API expects "status.code" and the v2 API expects "status"
                // so Tempo doesn't send anything and we inject it here for the autocomplete
                if (!this.tagsV1.find((t) => t === 'status.code')) {
                    this.tagsV1.push('status.code');
                }
                return this.tagsV1;
            }
            return [];
        };
        /**
         * Encode (serialize) a given tag for use in a URL.
         *
         * @param tag the tag to encode
         * @returns the encoded tag
         */
        this.encodeTag = (tag) => {
            // If we call `encodeURIComponent` only once, we still get an error when issuing a request to the backend
            // Reference: https://stackoverflow.com/a/37456192
            return encodeURIComponent(encodeURIComponent(tag));
        };
        this.datasource = datasource;
        Object.assign(this, initialValues);
    }
    fetchTags() {
        return __awaiter(this, void 0, void 0, function* () {
            let v1Resp, v2Resp;
            try {
                v2Resp = yield this.request('/api/v2/search/tags', []);
            }
            catch (error) {
                v1Resp = yield this.request('/api/search/tags', []);
            }
            if (v2Resp && v2Resp.scopes) {
                this.setV2Tags(v2Resp.scopes);
            }
            else if (v1Resp) {
                this.setV1Tags(v1Resp.tagNames);
            }
        });
    }
    getOptionsV1(tag) {
        return __awaiter(this, void 0, void 0, function* () {
            const encodedTag = this.encodeTag(tag);
            const response = yield this.request(`/api/search/tag/${encodedTag}/values`);
            let options = [];
            if (response && response.tagValues) {
                options = response.tagValues.map((v) => ({
                    value: v,
                    label: v,
                }));
            }
            return options;
        });
    }
    getOptionsV2(tag, query) {
        return __awaiter(this, void 0, void 0, function* () {
            const encodedTag = this.encodeTag(tag);
            const response = yield this.request(`/api/v2/search/tag/${encodedTag}/values`, query ? { q: query } : {});
            let options = [];
            if (response && response.tagValues) {
                response.tagValues.forEach((v) => {
                    if (v.value) {
                        options.push({
                            type: v.type,
                            value: v.value,
                            label: v.value,
                        });
                    }
                });
            }
            return options;
        });
    }
}
//# sourceMappingURL=language_provider.js.map