import { __assign, __read, __spreadArray } from "tslib";
// Libraries
import { isEqual, omit } from 'lodash';
// Services & Utils
import { dateTimeFormat, urlUtil } from '@grafana/data';
import store from 'app/core/store';
import { dispatch } from 'app/store/store';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification, createWarningNotification } from 'app/core/copy/appNotification';
import { serializeStateToUrlParam } from '@grafana/data/src/utils/url';
import { getDataSourceSrv } from '@grafana/runtime';
var RICH_HISTORY_KEY = 'grafana.explore.richHistory';
export var RICH_HISTORY_SETTING_KEYS = {
    retentionPeriod: 'grafana.explore.richHistory.retentionPeriod',
    starredTabAsFirstTab: 'grafana.explore.richHistory.starredTabAsFirstTab',
    activeDatasourceOnly: 'grafana.explore.richHistory.activeDatasourceOnly',
    datasourceFilters: 'grafana.explore.richHistory.datasourceFilters',
};
export var SortOrder;
(function (SortOrder) {
    SortOrder["Descending"] = "Descending";
    SortOrder["Ascending"] = "Ascending";
    SortOrder["DatasourceAZ"] = "Datasource A-Z";
    SortOrder["DatasourceZA"] = "Datasource Z-A";
})(SortOrder || (SortOrder = {}));
/*
 * Add queries to rich history. Save only queries within the retention period, or that are starred.
 * Side-effect: store history in local storage
 */
export var MAX_HISTORY_ITEMS = 10000;
export function addToRichHistory(richHistory, datasourceId, datasourceName, queries, starred, comment, sessionName, showQuotaExceededError, showLimitExceededWarning) {
    var ts = Date.now();
    /* Save only queries, that are not falsy (e.g. empty object, null, ...) */
    var newQueriesToSave = queries && queries.filter(function (query) { return notEmptyQuery(query); });
    var retentionPeriod = store.getObject(RICH_HISTORY_SETTING_KEYS.retentionPeriod, 7);
    var retentionPeriodLastTs = createRetentionPeriodBoundary(retentionPeriod, false);
    /* Keep only queries, that are within the selected retention period or that are starred.
     * If no queries, initialize with empty array
     */
    var queriesToKeep = richHistory.filter(function (q) { return q.ts > retentionPeriodLastTs || q.starred === true; }) || [];
    if (newQueriesToSave.length > 0) {
        /* Compare queries of a new query and last saved queries. If they are the same, (except selected properties,
         * which can be different) don't save it in rich history.
         */
        var newQueriesToCompare = newQueriesToSave.map(function (q) { return omit(q, ['key', 'refId']); });
        var lastQueriesToCompare = queriesToKeep.length > 0 &&
            queriesToKeep[0].queries.map(function (q) {
                return omit(q, ['key', 'refId']);
            });
        if (isEqual(newQueriesToCompare, lastQueriesToCompare)) {
            return { richHistory: richHistory };
        }
        // remove oldest non-starred items to give space for the recent query
        var limitExceeded = false;
        var current = queriesToKeep.length - 1;
        while (current >= 0 && queriesToKeep.length >= MAX_HISTORY_ITEMS) {
            if (!queriesToKeep[current].starred) {
                queriesToKeep.splice(current, 1);
                limitExceeded = true;
            }
            current--;
        }
        var updatedHistory = __spreadArray([
            {
                queries: newQueriesToSave,
                ts: ts,
                datasourceId: datasourceId,
                datasourceName: datasourceName !== null && datasourceName !== void 0 ? datasourceName : '',
                starred: starred,
                comment: comment !== null && comment !== void 0 ? comment : '',
                sessionName: sessionName,
            }
        ], __read(queriesToKeep), false);
        try {
            showLimitExceededWarning &&
                limitExceeded &&
                dispatch(notifyApp(createWarningNotification("Query history reached the limit of " + MAX_HISTORY_ITEMS + ". Old, not-starred items will be removed.")));
            store.setObject(RICH_HISTORY_KEY, updatedHistory);
            return { richHistory: updatedHistory, limitExceeded: limitExceeded, localStorageFull: false };
        }
        catch (error) {
            showQuotaExceededError &&
                dispatch(notifyApp(createErrorNotification('Saving rich history failed', error.message)));
            return { richHistory: updatedHistory, limitExceeded: limitExceeded, localStorageFull: error.name === 'QuotaExceededError' };
        }
    }
    return { richHistory: richHistory };
}
export function getRichHistory() {
    var richHistory = store.getObject(RICH_HISTORY_KEY, []);
    var transformedRichHistory = migrateRichHistory(richHistory);
    return transformedRichHistory;
}
export function deleteAllFromRichHistory() {
    return store.delete(RICH_HISTORY_KEY);
}
export function updateStarredInRichHistory(richHistory, ts) {
    var updatedHistory = richHistory.map(function (query) {
        /* Timestamps are currently unique - we can use them to identify specific queries */
        if (query.ts === ts) {
            var isStarred = query.starred;
            var updatedQuery = Object.assign({}, query, { starred: !isStarred });
            return updatedQuery;
        }
        return query;
    });
    try {
        store.setObject(RICH_HISTORY_KEY, updatedHistory);
        return updatedHistory;
    }
    catch (error) {
        dispatch(notifyApp(createErrorNotification('Saving rich history failed', error.message)));
        return richHistory;
    }
}
export function updateCommentInRichHistory(richHistory, ts, newComment) {
    var updatedHistory = richHistory.map(function (query) {
        if (query.ts === ts) {
            var updatedQuery = Object.assign({}, query, { comment: newComment });
            return updatedQuery;
        }
        return query;
    });
    try {
        store.setObject(RICH_HISTORY_KEY, updatedHistory);
        return updatedHistory;
    }
    catch (error) {
        dispatch(notifyApp(createErrorNotification('Saving rich history failed', error.message)));
        return richHistory;
    }
}
export function deleteQueryInRichHistory(richHistory, ts) {
    var updatedHistory = richHistory.filter(function (query) { return query.ts !== ts; });
    try {
        store.setObject(RICH_HISTORY_KEY, updatedHistory);
        return updatedHistory;
    }
    catch (error) {
        dispatch(notifyApp(createErrorNotification('Saving rich history failed', error.message)));
        return richHistory;
    }
}
export var sortQueries = function (array, sortOrder) {
    var sortFunc;
    if (sortOrder === SortOrder.Ascending) {
        sortFunc = function (a, b) { return (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0); };
    }
    if (sortOrder === SortOrder.Descending) {
        sortFunc = function (a, b) { return (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0); };
    }
    if (sortOrder === SortOrder.DatasourceZA) {
        sortFunc = function (a, b) {
            return a.datasourceName < b.datasourceName ? -1 : a.datasourceName > b.datasourceName ? 1 : 0;
        };
    }
    if (sortOrder === SortOrder.DatasourceAZ) {
        sortFunc = function (a, b) {
            return a.datasourceName < b.datasourceName ? 1 : a.datasourceName > b.datasourceName ? -1 : 0;
        };
    }
    return array.sort(sortFunc);
};
export var createUrlFromRichHistory = function (query) {
    var exploreState = {
        /* Default range, as we are not saving timerange in rich history */
        range: { from: 'now-1h', to: 'now' },
        datasource: query.datasourceName,
        queries: query.queries,
        context: 'explore',
    };
    var serializedState = serializeStateToUrlParam(exploreState, true);
    var baseUrl = /.*(?=\/explore)/.exec("" + window.location.href)[0];
    var url = urlUtil.renderUrl(baseUrl + "/explore", { left: serializedState });
    return url;
};
/* Needed for slider in Rich history to map numerical values to meaningful strings */
export var mapNumbertoTimeInSlider = function (num) {
    var str;
    switch (num) {
        case 0:
            str = 'today';
            break;
        case 1:
            str = 'yesterday';
            break;
        case 7:
            str = 'a week ago';
            break;
        case 14:
            str = 'two weeks ago';
            break;
        default:
            str = num + " days ago";
    }
    return str;
};
export var createRetentionPeriodBoundary = function (days, isLastTs) {
    var today = new Date();
    var date = new Date(today.setDate(today.getDate() - days));
    /*
     * As a retention period boundaries, we consider:
     * - The last timestamp equals to the 24:00 of the last day of retention
     * - The first timestamp that equals to the 00:00 of the first day of retention
     */
    var boundary = isLastTs ? date.setHours(24, 0, 0, 0) : date.setHours(0, 0, 0, 0);
    return boundary;
};
export function createDateStringFromTs(ts) {
    return dateTimeFormat(ts, {
        format: 'MMMM D',
    });
}
export function getQueryDisplayText(query) {
    /* If datasource doesn't have getQueryDisplayText, create query display text by
     * stringifying query that was stripped of key, refId and datasource for nicer
     * formatting and improved readability
     */
    var strippedQuery = omit(query, ['key', 'refId', 'datasource']);
    return JSON.stringify(strippedQuery);
}
export function createQueryHeading(query, sortOrder) {
    var heading = '';
    if (sortOrder === SortOrder.DatasourceAZ || sortOrder === SortOrder.DatasourceZA) {
        heading = query.datasourceName;
    }
    else {
        heading = createDateStringFromTs(query.ts);
    }
    return heading;
}
export function createQueryText(query, queryDsInstance) {
    /* query DatasourceInstance is necessary because we use its getQueryDisplayText method
     * to format query text
     */
    if (queryDsInstance === null || queryDsInstance === void 0 ? void 0 : queryDsInstance.getQueryDisplayText) {
        return queryDsInstance.getQueryDisplayText(query);
    }
    return getQueryDisplayText(query);
}
export function mapQueriesToHeadings(query, sortOrder) {
    var mappedQueriesToHeadings = {};
    query.forEach(function (q) {
        var heading = createQueryHeading(q, sortOrder);
        if (!(heading in mappedQueriesToHeadings)) {
            mappedQueriesToHeadings[heading] = [q];
        }
        else {
            mappedQueriesToHeadings[heading] = __spreadArray(__spreadArray([], __read(mappedQueriesToHeadings[heading]), false), [q], false);
        }
    });
    return mappedQueriesToHeadings;
}
/* Create datasource list with images. If specific datasource retrieved from Rich history is not part of
 * exploreDatasources add generic datasource image and add property isRemoved = true.
 */
export function createDatasourcesList(queriesDatasources) {
    var datasources = [];
    queriesDatasources.forEach(function (dsName) {
        var dsSettings = getDataSourceSrv().getInstanceSettings(dsName);
        if (dsSettings) {
            datasources.push({
                label: dsSettings.name,
                value: dsSettings.name,
                imgUrl: dsSettings.meta.info.logos.small,
                isRemoved: false,
            });
        }
        else {
            datasources.push({
                label: dsName,
                value: dsName,
                imgUrl: 'public/img/icn-datasource.svg',
                isRemoved: true,
            });
        }
    });
    return datasources;
}
export function notEmptyQuery(query) {
    /* Check if query has any other properties besides key, refId and datasource.
     * If not, then we consider it empty query.
     */
    var strippedQuery = omit(query, ['key', 'refId', 'datasource']);
    var queryKeys = Object.keys(strippedQuery);
    if (queryKeys.length > 0) {
        return true;
    }
    return false;
}
export function filterQueriesBySearchFilter(queries, searchFilter) {
    return queries.filter(function (query) {
        if (query.comment.includes(searchFilter)) {
            return true;
        }
        var listOfMatchingQueries = query.queries.filter(function (query) {
            // Remove fields in which we don't want to be searching
            return Object.values(omit(query, ['datasource', 'key', 'refId', 'hide', 'queryType'])).some(function (value) {
                return value === null || value === void 0 ? void 0 : value.toString().includes(searchFilter);
            });
        });
        return listOfMatchingQueries.length > 0;
    });
}
export function filterQueriesByDataSource(queries, listOfDatasourceFilters) {
    return listOfDatasourceFilters && listOfDatasourceFilters.length > 0
        ? queries.filter(function (q) { return listOfDatasourceFilters.includes(q.datasourceName); })
        : queries;
}
export function filterQueriesByTime(queries, timeFilter) {
    return queries.filter(function (q) {
        return q.ts < createRetentionPeriodBoundary(timeFilter[0], true) &&
            q.ts > createRetentionPeriodBoundary(timeFilter[1], false);
    });
}
export function filterAndSortQueries(queries, sortOrder, listOfDatasourceFilters, searchFilter, timeFilter) {
    var filteredQueriesByDs = filterQueriesByDataSource(queries, listOfDatasourceFilters);
    var filteredQueriesByDsAndSearchFilter = filterQueriesBySearchFilter(filteredQueriesByDs, searchFilter);
    var filteredQueriesToBeSorted = timeFilter
        ? filterQueriesByTime(filteredQueriesByDsAndSearchFilter, timeFilter)
        : filteredQueriesByDsAndSearchFilter;
    return sortQueries(filteredQueriesToBeSorted, sortOrder);
}
function migrateRichHistory(richHistory) {
    var transformedRichHistory = richHistory.map(function (query) {
        var transformedQueries = query.queries.map(function (q, index) { return createDataQuery(query, q, index); });
        return __assign(__assign({}, query), { queries: transformedQueries });
    });
    return transformedRichHistory;
}
function createDataQuery(query, individualQuery, index) {
    var letters = 'ABCDEFGHIJKLMNOPQRSTUVXYZ';
    if (typeof individualQuery === 'object') {
        // the current format
        return individualQuery;
    }
    else if (isParsable(individualQuery)) {
        // ElasticSearch (maybe other datasoures too) before grafana7
        return JSON.parse(individualQuery);
    }
    // prometehus (maybe other datasources too) before grafana7
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
//# sourceMappingURL=richHistory.js.map