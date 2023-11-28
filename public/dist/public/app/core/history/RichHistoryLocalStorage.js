import { __awaiter } from "tslib";
import { find, isEqual, omit } from 'lodash';
import store from '../store';
import { RichHistoryServiceError, RichHistoryStorageWarning } from './RichHistoryStorage';
import { fromDTO, toDTO } from './localStorageConverter';
import { createRetentionPeriodBoundary, filterAndSortQueries, RICH_HISTORY_SETTING_KEYS, } from './richHistoryLocalStorageUtils';
export const RICH_HISTORY_KEY = 'grafana.explore.richHistory';
export const MAX_HISTORY_ITEMS = 10000;
/**
 * Local storage implementation for Rich History. It keeps all entries in browser's local storage.
 */
export default class RichHistoryLocalStorage {
    /**
     * Return history entries based on provided filters, perform migration and clean up entries not matching retention policy.
     */
    getRichHistory(filters) {
        return __awaiter(this, void 0, void 0, function* () {
            const allQueries = getRichHistoryDTOs().map(fromDTO);
            const queries = filters.starred ? allQueries.filter((q) => q.starred === true) : allQueries;
            const richHistory = filterAndSortQueries(queries, filters.sortOrder, filters.datasourceFilters, filters.search, [
                filters.from,
                filters.to,
            ]);
            return { richHistory, total: richHistory.length };
        });
    }
    addToRichHistory(newRichHistoryQuery) {
        return __awaiter(this, void 0, void 0, function* () {
            const ts = Date.now();
            const richHistoryQuery = Object.assign({ id: ts.toString(), createdAt: ts }, newRichHistoryQuery);
            const newRichHistoryQueryDTO = toDTO(richHistoryQuery);
            const currentRichHistoryDTOs = cleanUp(getRichHistoryDTOs());
            /* Compare queries of a new query and last saved queries. If they are the same, (except selected properties,
             * which can be different) don't save it in rich history.
             */
            const newQueriesToCompare = newRichHistoryQueryDTO.queries.map((q) => omit(q, ['key', 'refId']));
            const lastQueriesToCompare = currentRichHistoryDTOs.length > 0 &&
                currentRichHistoryDTOs[0].queries.map((q) => {
                    return omit(q, ['key', 'refId']);
                });
            if (isEqual(newQueriesToCompare, lastQueriesToCompare)) {
                const error = new Error('Entry already exists');
                error.name = RichHistoryServiceError.DuplicatedEntry;
                throw error;
            }
            const { queriesToKeep, limitExceeded } = checkLimits(currentRichHistoryDTOs);
            const updatedHistory = [newRichHistoryQueryDTO, ...queriesToKeep];
            try {
                store.setObject(RICH_HISTORY_KEY, updatedHistory);
            }
            catch (error) {
                if (error instanceof Error && error.name === 'QuotaExceededError') {
                    throwError(RichHistoryServiceError.StorageFull, `Saving rich history failed: ${error.message}`);
                }
                else {
                    throw error;
                }
            }
            if (limitExceeded) {
                return {
                    warning: {
                        type: RichHistoryStorageWarning.LimitExceeded,
                        message: `Query history reached the limit of ${MAX_HISTORY_ITEMS}. Old, not-starred items have been removed.`,
                    },
                    richHistoryQuery,
                };
            }
            return { richHistoryQuery };
        });
    }
    deleteAll() {
        return __awaiter(this, void 0, void 0, function* () {
            store.delete(RICH_HISTORY_KEY);
        });
    }
    deleteRichHistory(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const ts = parseInt(id, 10);
            const richHistory = store.getObject(RICH_HISTORY_KEY, []);
            const updatedHistory = richHistory.filter((query) => query.ts !== ts);
            store.setObject(RICH_HISTORY_KEY, updatedHistory);
        });
    }
    updateStarred(id, starred) {
        return __awaiter(this, void 0, void 0, function* () {
            return updateRichHistory(id, (richHistoryDTO) => (richHistoryDTO.starred = starred));
        });
    }
    updateComment(id, comment) {
        return __awaiter(this, void 0, void 0, function* () {
            return updateRichHistory(id, (richHistoryDTO) => (richHistoryDTO.comment = comment));
        });
    }
    getSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            return {
                activeDatasourceOnly: store.getObject(RICH_HISTORY_SETTING_KEYS.activeDatasourceOnly, false),
                retentionPeriod: store.getObject(RICH_HISTORY_SETTING_KEYS.retentionPeriod, 7),
                starredTabAsFirstTab: store.getBool(RICH_HISTORY_SETTING_KEYS.starredTabAsFirstTab, false),
                lastUsedDatasourceFilters: store
                    .getObject(RICH_HISTORY_SETTING_KEYS.datasourceFilters, [])
                    .map((selectableValue) => selectableValue.value),
            };
        });
    }
    updateSettings(settings) {
        return __awaiter(this, void 0, void 0, function* () {
            store.set(RICH_HISTORY_SETTING_KEYS.activeDatasourceOnly, settings.activeDatasourceOnly);
            store.set(RICH_HISTORY_SETTING_KEYS.retentionPeriod, settings.retentionPeriod);
            store.set(RICH_HISTORY_SETTING_KEYS.starredTabAsFirstTab, settings.starredTabAsFirstTab);
            store.setObject(RICH_HISTORY_SETTING_KEYS.datasourceFilters, (settings.lastUsedDatasourceFilters || []).map((datasourceName) => {
                return { value: datasourceName };
            }));
        });
    }
}
function updateRichHistory(id, updateCallback) {
    const ts = parseInt(id, 10);
    const richHistoryDTOs = store.getObject(RICH_HISTORY_KEY, []);
    const richHistoryDTO = find(richHistoryDTOs, { ts });
    if (!richHistoryDTO) {
        throw new Error('Rich history item not found.');
    }
    updateCallback(richHistoryDTO);
    store.setObject(RICH_HISTORY_KEY, richHistoryDTOs);
    return fromDTO(richHistoryDTO);
}
/**
 * Removes entries that do not match retention policy criteria.
 */
function cleanUp(richHistory) {
    const retentionPeriod = store.getObject(RICH_HISTORY_SETTING_KEYS.retentionPeriod, 7);
    const retentionPeriodLastTs = createRetentionPeriodBoundary(retentionPeriod, false);
    /* Keep only queries, that are within the selected retention period or that are starred.
     * If no queries, initialize with empty array
     */
    return richHistory.filter((q) => q.ts > retentionPeriodLastTs || q.starred === true) || [];
}
/**
 * Ensures the entry can be added. Throws an error if current limit has been hit.
 * Returns queries that should be saved back giving space for one extra query.
 */
function checkLimits(queriesToKeep) {
    // remove oldest non-starred items to give space for the recent query
    let limitExceeded = false;
    let current = queriesToKeep.length - 1;
    while (current >= 0 && queriesToKeep.length >= MAX_HISTORY_ITEMS) {
        if (!queriesToKeep[current].starred) {
            queriesToKeep.splice(current, 1);
            limitExceeded = true;
        }
        current--;
    }
    return { queriesToKeep, limitExceeded };
}
function getRichHistoryDTOs() {
    const richHistory = store.getObject(RICH_HISTORY_KEY, []);
    return migrateRichHistory(richHistory);
}
function migrateRichHistory(richHistory) {
    const transformedRichHistory = richHistory.map((query) => {
        const transformedQueries = query.queries.map((q, index) => createDataQuery(query, q, index));
        return Object.assign(Object.assign({}, query), { queries: transformedQueries });
    });
    return transformedRichHistory;
}
function createDataQuery(query, individualQuery, index) {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVXYZ';
    if (typeof individualQuery === 'object') {
        // the current format
        return individualQuery;
    }
    else if (isParsable(individualQuery)) {
        // ElasticSearch (maybe other datasoures too) before grafana7
        return JSON.parse(individualQuery);
    }
    // prometheus (maybe other datasources too) before grafana7
    return { expr: individualQuery, refId: letters[index] };
}
function isParsable(string) {
    try {
        JSON.parse(string);
    }
    catch (e) {
        return false;
    }
    return true;
}
function throwError(name, message) {
    const error = new Error(message);
    error.name = name;
    throw error;
}
//# sourceMappingURL=RichHistoryLocalStorage.js.map