import { __awaiter } from "tslib";
import { DataFrameView, FieldType, getDisplayProcessor } from '@grafana/data';
import { config } from '@grafana/runtime';
import { backendSrv } from 'app/core/services/backend_srv';
import { DEFAULT_MAX_VALUES, TYPE_KIND_MAP } from '../constants';
import { replaceCurrentFolderQuery } from './utils';
export class SQLSearcher {
    constructor() {
        this.locationInfo = {
            general: {
                kind: 'folder',
                name: 'General',
                url: '/dashboards',
                folderId: 0,
            },
        }; // share location info with everyone
        this.getFolderViewSort = () => {
            // sorts alphabetically in memory after retrieving the folders from the database
            return '';
        };
    }
    composeQuery(apiQuery, searchOptions) {
        var _a, _b, _c;
        return __awaiter(this, void 0, void 0, function* () {
            const query = yield replaceCurrentFolderQuery(searchOptions);
            if (((_a = query.query) === null || _a === void 0 ? void 0 : _a.length) && query.query !== '*') {
                apiQuery.query = query.query;
            }
            // search v1 supports only one kind
            if (((_b = query.kind) === null || _b === void 0 ? void 0 : _b.length) === 1 && TYPE_KIND_MAP[query.kind[0]]) {
                apiQuery.type = TYPE_KIND_MAP[query.kind[0]];
            }
            if (query.uid) {
                apiQuery.dashboardUID = query.uid;
            }
            else if ((_c = query.location) === null || _c === void 0 ? void 0 : _c.length) {
                apiQuery.folderUIDs = [query.location];
            }
            return apiQuery;
        });
    }
    search(query) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            if ((_a = query.facet) === null || _a === void 0 ? void 0 : _a.length) {
                throw new Error('facets not supported!');
            }
            if (query.from !== undefined) {
                if (!query.limit) {
                    throw new Error('Must specify non-zero limit parameter when using from');
                }
                if ((query.from / query.limit) % 1 !== 0) {
                    throw new Error('From parameter must be a multiple of limit');
                }
            }
            const limit = (_b = query.limit) !== null && _b !== void 0 ? _b : (query.from !== undefined ? 1 : DEFAULT_MAX_VALUES);
            const page = query.from !== undefined
                ? // prettier-ignore
                    (query.from / limit) + 1 // pages are 1-indexed, so need to +1 to get there
                : undefined;
            const q = yield this.composeQuery({
                limit: limit,
                tag: query.tags,
                sort: query.sort,
                page,
            }, query);
            return this.doAPIQuery(q);
        });
    }
    starred(query) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            if ((_a = query.facet) === null || _a === void 0 ? void 0 : _a.length) {
                throw new Error('facets not supported!');
            }
            const q = yield this.composeQuery({
                limit: (_b = query.limit) !== null && _b !== void 0 ? _b : DEFAULT_MAX_VALUES,
                tag: query.tags,
                sort: query.sort,
                starred: query.starred,
            }, query);
            return this.doAPIQuery(q);
        });
    }
    // returns the appropriate sorting options
    getSortOptions() {
        return __awaiter(this, void 0, void 0, function* () {
            // {
            //   "sortOptions": [
            //     {
            //       "description": "Sort results in an alphabetically ascending order",
            //       "displayName": "Alphabetically (A–Z)",
            //       "meta": "",
            //       "name": "alpha-asc"
            //     },
            //     {
            //       "description": "Sort results in an alphabetically descending order",
            //       "displayName": "Alphabetically (Z–A)",
            //       "meta": "",
            //       "name": "alpha-desc"
            //     }
            //   ]
            // }
            const opts = yield backendSrv.get('/api/search/sorting');
            return opts.sortOptions.map((v) => ({
                value: v.name,
                label: v.displayName,
            }));
        });
    }
    // NOTE: the bluge query will find tags within the current results, the SQL based one does not
    tags(query) {
        return __awaiter(this, void 0, void 0, function* () {
            const terms = yield backendSrv.get('/api/dashboards/tags');
            return terms.sort((a, b) => b.count - a.count);
        });
    }
    doAPIQuery(query) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const rsp = yield backendSrv.get('/api/search', query);
            // Field values (columnar)
            const kind = [];
            const name = [];
            const uid = [];
            const url = [];
            const tags = [];
            const location = [];
            const sortBy = [];
            let sortMetaName;
            for (let hit of rsp) {
                const k = hit.type === 'dash-folder' ? 'folder' : 'dashboard';
                kind.push(k);
                name.push(hit.title);
                uid.push(hit.uid);
                url.push(hit.url);
                tags.push(hit.tags);
                sortBy.push(hit.sortMeta);
                let v = hit.folderUid;
                if (!v && k === 'dashboard') {
                    v = 'general';
                }
                location.push(v);
                if ((_a = hit.sortMetaName) === null || _a === void 0 ? void 0 : _a.length) {
                    sortMetaName = hit.sortMetaName;
                }
                if (hit.folderUid && hit.folderTitle) {
                    this.locationInfo[hit.folderUid] = {
                        kind: 'folder',
                        name: hit.folderTitle,
                        url: hit.folderUrl,
                        folderId: hit.folderId,
                    };
                }
                else if (k === 'folder') {
                    this.locationInfo[hit.uid] = {
                        kind: k,
                        name: hit.title,
                        url: hit.url,
                        folderId: hit.id,
                    };
                }
            }
            const data = {
                fields: [
                    { name: 'kind', type: FieldType.string, config: {}, values: kind },
                    { name: 'name', type: FieldType.string, config: {}, values: name },
                    { name: 'uid', type: FieldType.string, config: {}, values: uid },
                    { name: 'url', type: FieldType.string, config: {}, values: url },
                    { name: 'tags', type: FieldType.other, config: {}, values: tags },
                    { name: 'location', type: FieldType.string, config: {}, values: location },
                ],
                length: name.length,
                meta: {
                    custom: {
                        count: name.length,
                        max_score: 1,
                        locationInfo: this.locationInfo,
                    },
                },
            };
            // Add enterprise sort fields as a field in the frame
            if ((sortMetaName === null || sortMetaName === void 0 ? void 0 : sortMetaName.length) && sortBy.length) {
                data.meta.custom.sortBy = sortMetaName;
                data.fields.push({
                    name: sortMetaName,
                    type: FieldType.number,
                    config: {},
                    values: sortBy,
                });
            }
            for (const field of data.fields) {
                field.display = getDisplayProcessor({ field, theme: config.theme2 });
            }
            const view = new DataFrameView(data);
            return {
                totalRows: data.length,
                view,
                // Paging not supported with this version
                loadMoreItems: (startIndex, stopIndex) => __awaiter(this, void 0, void 0, function* () { }),
                isItemLoaded: (index) => true,
            };
        });
    }
}
//# sourceMappingURL=sql.js.map