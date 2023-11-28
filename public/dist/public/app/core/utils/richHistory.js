import { __awaiter } from "tslib";
import { omit } from 'lodash';
import { dateTimeFormat, urlUtil } from '@grafana/data';
import { serializeStateToUrlParam } from '@grafana/data/src/utils/url';
import { getDataSourceSrv } from '@grafana/runtime';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification, createWarningNotification } from 'app/core/copy/appNotification';
import { dispatch } from 'app/store/store';
import { RichHistoryServiceError, RichHistoryStorageWarning, } from '../history/RichHistoryStorage';
import { getRichHistoryStorage } from '../history/richHistoryStorageProvider';
import { SortOrder } from './richHistoryTypes';
export { SortOrder };
/*
 * Add queries to rich history. Save only queries within the retention period, or that are starred.
 * Side-effect: store history in local storage
 */
export function addToRichHistory(datasourceUid, datasourceName, queries, starred, comment, showQuotaExceededError, showLimitExceededWarning) {
    return __awaiter(this, void 0, void 0, function* () {
        /* Save only queries, that are not falsy (e.g. empty object, null, ...) */
        const newQueriesToSave = queries && queries.filter((query) => notEmptyQuery(query));
        if (newQueriesToSave.length > 0) {
            let richHistoryStorageFull = false;
            let limitExceeded = false;
            let warning;
            try {
                const result = yield getRichHistoryStorage().addToRichHistory({
                    datasourceUid: datasourceUid,
                    datasourceName: datasourceName !== null && datasourceName !== void 0 ? datasourceName : '',
                    queries: newQueriesToSave,
                    starred,
                    comment: comment !== null && comment !== void 0 ? comment : '',
                });
                warning = result.warning;
            }
            catch (error) {
                if (error instanceof Error) {
                    if (error.name === RichHistoryServiceError.StorageFull) {
                        richHistoryStorageFull = true;
                        showQuotaExceededError && dispatch(notifyApp(createErrorNotification(error.message)));
                    }
                    else if (error.name !== RichHistoryServiceError.DuplicatedEntry) {
                        dispatch(notifyApp(createErrorNotification('Rich History update failed', error.message)));
                    }
                }
                // Saving failed. Do not add new entry.
                return { richHistoryStorageFull, limitExceeded };
            }
            // Limit exceeded but new entry was added. Notify that old entries have been removed.
            if (warning && warning.type === RichHistoryStorageWarning.LimitExceeded) {
                limitExceeded = true;
                showLimitExceededWarning && dispatch(notifyApp(createWarningNotification(warning.message)));
            }
            return { richHistoryStorageFull, limitExceeded };
        }
        // Nothing to change
        return {};
    });
}
export function getRichHistory(filters) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield getRichHistoryStorage().getRichHistory(filters);
    });
}
export function updateRichHistorySettings(settings) {
    return __awaiter(this, void 0, void 0, function* () {
        yield getRichHistoryStorage().updateSettings(settings);
    });
}
export function getRichHistorySettings() {
    return __awaiter(this, void 0, void 0, function* () {
        return yield getRichHistoryStorage().getSettings();
    });
}
export function deleteAllFromRichHistory() {
    return __awaiter(this, void 0, void 0, function* () {
        return getRichHistoryStorage().deleteAll();
    });
}
export function updateStarredInRichHistory(id, starred) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            return yield getRichHistoryStorage().updateStarred(id, starred);
        }
        catch (error) {
            if (error instanceof Error) {
                dispatch(notifyApp(createErrorNotification('Saving rich history failed', error.message)));
            }
            return undefined;
        }
    });
}
export function updateCommentInRichHistory(id, newComment) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            return yield getRichHistoryStorage().updateComment(id, newComment);
        }
        catch (error) {
            if (error instanceof Error) {
                dispatch(notifyApp(createErrorNotification('Saving rich history failed', error.message)));
            }
            return undefined;
        }
    });
}
export function deleteQueryInRichHistory(id) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield getRichHistoryStorage().deleteRichHistory(id);
            return id;
        }
        catch (error) {
            if (error instanceof Error) {
                dispatch(notifyApp(createErrorNotification('Saving rich history failed', error.message)));
            }
            return undefined;
        }
    });
}
export const createUrlFromRichHistory = (query) => {
    const exploreState = {
        /* Default range, as we are not saving timerange in rich history */
        range: { from: 'now-1h', to: 'now' },
        datasource: query.datasourceName,
        queries: query.queries,
    };
    const serializedState = serializeStateToUrlParam(exploreState);
    const baseUrl = /.*(?=\/explore)/.exec(`${window.location.href}`)[0];
    const url = urlUtil.renderUrl(`${baseUrl}/explore`, { left: serializedState });
    return url;
};
/* Needed for slider in Rich history to map numerical values to meaningful strings */
export const mapNumbertoTimeInSlider = (num) => {
    let str;
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
            str = `${num} days ago`;
    }
    return str;
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
    const strippedQuery = omit(query, ['key', 'refId', 'datasource']);
    return JSON.stringify(strippedQuery);
}
export function createQueryHeading(query, sortOrder) {
    let heading = '';
    if (sortOrder === SortOrder.DatasourceAZ || sortOrder === SortOrder.DatasourceZA) {
        heading = query.datasourceName;
    }
    else {
        heading = createDateStringFromTs(query.createdAt);
    }
    return heading;
}
export function createQueryText(query, dsApi) {
    if (dsApi === null || dsApi === void 0 ? void 0 : dsApi.getQueryDisplayText) {
        return dsApi.getQueryDisplayText(query);
    }
    return getQueryDisplayText(query);
}
export function mapQueriesToHeadings(query, sortOrder) {
    let mappedQueriesToHeadings = {};
    query.forEach((q) => {
        let heading = createQueryHeading(q, sortOrder);
        if (!(heading in mappedQueriesToHeadings)) {
            mappedQueriesToHeadings[heading] = [q];
        }
        else {
            mappedQueriesToHeadings[heading] = [...mappedQueriesToHeadings[heading], q];
        }
    });
    return mappedQueriesToHeadings;
}
/*
 * Create a list of all available data sources
 */
export function createDatasourcesList() {
    return getDataSourceSrv()
        .getList({ mixed: true })
        .map((dsSettings) => {
        return {
            name: dsSettings.name,
            uid: dsSettings.uid,
        };
    });
}
export function notEmptyQuery(query) {
    /* Check if query has any other properties besides key, refId and datasource.
     * If not, then we consider it empty query.
     */
    const strippedQuery = omit(query, ['key', 'refId', 'datasource']);
    const queryKeys = Object.keys(strippedQuery);
    if (queryKeys.length > 0) {
        return true;
    }
    return false;
}
//# sourceMappingURL=richHistory.js.map