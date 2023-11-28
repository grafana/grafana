import { __awaiter } from "tslib";
import { DataFrameView, getDisplayProcessor, toDataFrame, } from '@grafana/data';
import { config, getBackendSrv } from '@grafana/runtime';
import { replaceCurrentFolderQuery } from './utils';
// The backend returns an empty frame with a special name to indicate that the indexing engine is being rebuilt,
// and that it can not serve any search requests. We are temporarily using the old SQL Search API as a fallback when that happens.
const loadingFrameName = 'Loading';
const searchURI = 'api/search-v2';
const folderViewSort = 'name_sort';
export class BlugeSearcher {
    constructor(fallbackSearcher) {
        this.fallbackSearcher = fallbackSearcher;
    }
    search(query) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            if ((_a = query.facet) === null || _a === void 0 ? void 0 : _a.length) {
                throw new Error('facets not supported!');
            }
            return this.doSearchQuery(query);
        });
    }
    starred(query) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            if ((_a = query.facet) === null || _a === void 0 ? void 0 : _a.length) {
                throw new Error('facets not supported!');
            }
            // get the starred dashboards
            const starsUIDS = yield getBackendSrv().get('api/user/stars');
            if (starsUIDS === null || starsUIDS === void 0 ? void 0 : starsUIDS.length) {
                return this.doSearchQuery({
                    uid: starsUIDS,
                    query: (_b = query.query) !== null && _b !== void 0 ? _b : '*',
                });
            }
            // Nothing is starred
            return {
                view: new DataFrameView({ length: 0, fields: [] }),
                totalRows: 0,
                loadMoreItems: (startIndex, stopIndex) => __awaiter(this, void 0, void 0, function* () {
                    return;
                }),
                isItemLoaded: (index) => {
                    return true;
                },
            };
        });
    }
    tags(query) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            const req = Object.assign(Object.assign({}, query), { query: (_a = query.query) !== null && _a !== void 0 ? _a : '*', sort: undefined, facet: [{ field: 'tag' }], limit: 1 });
            const resp = yield getBackendSrv().post(searchURI, req);
            const frames = resp.frames.map((f) => toDataFrame(f));
            if (((_b = frames[0]) === null || _b === void 0 ? void 0 : _b.name) === loadingFrameName) {
                return this.fallbackSearcher.tags(query);
            }
            for (const frame of frames) {
                if (frame.fields[0].name === 'tag') {
                    return getTermCountsFrom(frame);
                }
            }
            return [];
        });
    }
    // This should eventually be filled by an API call, but hardcoded is a good start
    getSortOptions() {
        const opts = [
            { value: folderViewSort, label: 'Alphabetically (A-Z)' },
            { value: '-name_sort', label: 'Alphabetically (Z-A)' },
        ];
        if (config.licenseInfo.enabledFeatures.analytics) {
            for (const sf of sortFields) {
                opts.push({ value: `-${sf.name}`, label: `${sf.display} (most)` });
                opts.push({ value: `${sf.name}`, label: `${sf.display} (least)` });
            }
            for (const sf of sortTimeFields) {
                opts.push({ value: `-${sf.name}`, label: `${sf.display} (recent)` });
                opts.push({ value: `${sf.name}`, label: `${sf.display} (oldest)` });
            }
        }
        return Promise.resolve(opts);
    }
    doSearchQuery(query) {
        var _a, _b, _c, _d, _e;
        return __awaiter(this, void 0, void 0, function* () {
            query = yield replaceCurrentFolderQuery(query);
            const req = Object.assign(Object.assign({}, query), { query: (_a = query.query) !== null && _a !== void 0 ? _a : '*', limit: (_b = query.limit) !== null && _b !== void 0 ? _b : firstPageSize });
            const rsp = yield getBackendSrv().post(searchURI, req);
            const frames = rsp.frames.map((f) => toDataFrame(f));
            const first = frames.length ? toDataFrame(frames[0]) : { fields: [], length: 0 };
            if (first.name === loadingFrameName) {
                return this.fallbackSearcher.search(query);
            }
            for (const field of first.fields) {
                field.display = getDisplayProcessor({ field, theme: config.theme2 });
            }
            // Make sure the object exists
            if (!((_c = first.meta) === null || _c === void 0 ? void 0 : _c.custom)) {
                first.meta = Object.assign(Object.assign({}, first.meta), { custom: {
                        count: first.length,
                        max_score: 1,
                    } });
            }
            const meta = first.meta.custom;
            if (!meta.locationInfo) {
                meta.locationInfo = {}; // always set it so we can append
            }
            // Set the field name to a better display name
            if ((_d = meta.sortBy) === null || _d === void 0 ? void 0 : _d.length) {
                const field = first.fields.find((f) => f.name === meta.sortBy);
                if (field) {
                    const name = getSortFieldDisplayName(field.name);
                    meta.sortBy = name;
                    field.name = name; // make it look nicer
                }
            }
            let loadMax = 0;
            let pending = undefined;
            const getNextPage = () => __awaiter(this, void 0, void 0, function* () {
                var _f;
                while (loadMax > view.dataFrame.length) {
                    const from = view.dataFrame.length;
                    if (from >= meta.count) {
                        return;
                    }
                    const resp = yield getBackendSrv().post(searchURI, Object.assign(Object.assign({}, (req !== null && req !== void 0 ? req : {})), { from, limit: nextPageSizes }));
                    const frame = toDataFrame(resp.frames[0]);
                    if (!frame) {
                        console.log('no results', frame);
                        return;
                    }
                    if (frame.fields.length !== view.dataFrame.fields.length) {
                        console.log('invalid shape', frame, view.dataFrame);
                        return;
                    }
                    // Append the raw values to the same array buffer
                    const length = frame.length + view.dataFrame.length;
                    for (let i = 0; i < frame.fields.length; i++) {
                        const values = view.dataFrame.fields[i].values;
                        values.push(...frame.fields[i].values);
                    }
                    view.dataFrame.length = length;
                    // Add all the location lookup info
                    const submeta = (_f = frame.meta) === null || _f === void 0 ? void 0 : _f.custom;
                    if ((submeta === null || submeta === void 0 ? void 0 : submeta.locationInfo) && meta) {
                        for (const [key, value] of Object.entries(submeta.locationInfo)) {
                            meta.locationInfo[key] = value;
                        }
                    }
                }
                pending = undefined;
            });
            const view = new DataFrameView(first);
            return {
                totalRows: (_e = meta.count) !== null && _e !== void 0 ? _e : first.length,
                view,
                loadMoreItems: (startIndex, stopIndex) => __awaiter(this, void 0, void 0, function* () {
                    loadMax = Math.max(loadMax, stopIndex);
                    if (!pending) {
                        pending = getNextPage();
                    }
                    return pending;
                }),
                isItemLoaded: (index) => {
                    return index < view.dataFrame.length;
                },
            };
        });
    }
    getFolderViewSort() {
        return 'name_sort';
    }
}
const firstPageSize = 50;
const nextPageSizes = 100;
function getTermCountsFrom(frame) {
    const keys = frame.fields[0].values;
    const vals = frame.fields[1].values;
    const counts = [];
    for (let i = 0; i < frame.length; i++) {
        counts.push({ term: keys[i], count: vals[i] });
    }
    return counts;
}
// Enterprise only sort field values for dashboards
const sortFields = [
    { name: 'views_total', display: 'Views total' },
    { name: 'views_last_30_days', display: 'Views 30 days' },
    { name: 'errors_total', display: 'Errors total' },
    { name: 'errors_last_30_days', display: 'Errors 30 days' },
];
// Enterprise only time sort field values for dashboards
const sortTimeFields = [
    { name: 'created_at', display: 'Created time' },
    { name: 'updated_at', display: 'Updated time' },
];
/** Given the internal field name, this gives a reasonable display name for the table colum header */
function getSortFieldDisplayName(name) {
    for (const sf of sortFields) {
        if (sf.name === name) {
            return sf.display;
        }
    }
    for (const sf of sortTimeFields) {
        if (sf.name === name) {
            return sf.display;
        }
    }
    return name;
}
//# sourceMappingURL=bluge.js.map