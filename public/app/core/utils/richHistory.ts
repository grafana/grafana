import { omit } from 'lodash';

import { DataQuery, DataSourceApi, dateTimeFormat, ExploreUrlState, urlUtil } from '@grafana/data';
import { serializeStateToUrlParam } from '@grafana/data/src/utils/url';
import { getDataSourceSrv } from '@grafana/runtime';
import { notifyApp } from 'app/core/actions';
import {
  createErrorNotification,
  createSuccessNotification,
  createWarningNotification,
} from 'app/core/copy/appNotification';
import { dispatch } from 'app/store/store';
import { RichHistoryQuery } from 'app/types/explore';

import { config } from '../config';
import RichHistoryLocalStorage from '../history/RichHistoryLocalStorage';
import RichHistoryRemoteStorage from '../history/RichHistoryRemoteStorage';
import {
  RichHistoryResults,
  RichHistoryServiceError,
  RichHistoryStorageWarning,
  RichHistoryStorageWarningDetails,
} from '../history/RichHistoryStorage';
import { getRichHistoryStorage } from '../history/richHistoryStorageProvider';

import { RichHistorySearchFilters, RichHistorySettings, SortOrder } from './richHistoryTypes';

export { RichHistorySearchFilters, RichHistorySettings, SortOrder };

/*
 * Add queries to rich history. Save only queries within the retention period, or that are starred.
 * Side-effect: store history in local storage
 */

export async function addToRichHistory(
  datasourceUid: string,
  datasourceName: string | null,
  queries: DataQuery[],
  starred: boolean,
  comment: string | null,
  showQuotaExceededError: boolean,
  showLimitExceededWarning: boolean
): Promise<{ richHistoryStorageFull?: boolean; limitExceeded?: boolean }> {
  /* Save only queries, that are not falsy (e.g. empty object, null, ...) */
  const newQueriesToSave: DataQuery[] = queries && queries.filter((query) => notEmptyQuery(query));

  if (newQueriesToSave.length > 0) {
    let richHistoryStorageFull = false;
    let limitExceeded = false;
    let warning: RichHistoryStorageWarningDetails | undefined;

    try {
      const result = await getRichHistoryStorage().addToRichHistory({
        datasourceUid: datasourceUid,
        datasourceName: datasourceName ?? '',
        queries: newQueriesToSave,
        starred,
        comment: comment ?? '',
      });
      warning = result.warning;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === RichHistoryServiceError.StorageFull) {
          richHistoryStorageFull = true;
          showQuotaExceededError && dispatch(notifyApp(createErrorNotification(error.message)));
        } else if (error.name !== RichHistoryServiceError.DuplicatedEntry) {
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
}

export async function getRichHistory(filters: RichHistorySearchFilters): Promise<RichHistoryResults> {
  return await getRichHistoryStorage().getRichHistory(filters);
}

export async function updateRichHistorySettings(settings: RichHistorySettings): Promise<void> {
  await getRichHistoryStorage().updateSettings(settings);
}

export async function getRichHistorySettings(): Promise<RichHistorySettings> {
  return await getRichHistoryStorage().getSettings();
}

export async function deleteAllFromRichHistory(): Promise<void> {
  return getRichHistoryStorage().deleteAll();
}

export async function updateStarredInRichHistory(id: string, starred: boolean) {
  try {
    return await getRichHistoryStorage().updateStarred(id, starred);
  } catch (error) {
    if (error instanceof Error) {
      dispatch(notifyApp(createErrorNotification('Saving rich history failed', error.message)));
    }
    return undefined;
  }
}

export async function updateCommentInRichHistory(id: string, newComment: string | undefined) {
  try {
    return await getRichHistoryStorage().updateComment(id, newComment);
  } catch (error) {
    if (error instanceof Error) {
      dispatch(notifyApp(createErrorNotification('Saving rich history failed', error.message)));
    }
    return undefined;
  }
}

export async function deleteQueryInRichHistory(id: string) {
  try {
    await getRichHistoryStorage().deleteRichHistory(id);
    return id;
  } catch (error) {
    if (error instanceof Error) {
      dispatch(notifyApp(createErrorNotification('Saving rich history failed', error.message)));
    }
    return undefined;
  }
}

export enum LocalStorageMigrationStatus {
  Successful = 'successful',
  Failed = 'failed',
  NotNeeded = 'not-needed',
}

export interface LocalStorageMigrationResult {
  status: LocalStorageMigrationStatus;
  error?: Error;
}

export async function migrateQueryHistoryFromLocalStorage(): Promise<LocalStorageMigrationResult> {
  const richHistoryLocalStorage = new RichHistoryLocalStorage();
  const richHistoryRemoteStorage = new RichHistoryRemoteStorage();

  try {
    const { richHistory } = await richHistoryLocalStorage.getRichHistory({
      datasourceFilters: [],
      from: 0,
      search: '',
      sortOrder: SortOrder.Descending,
      starred: false,
      to: 14,
    });
    if (richHistory.length === 0) {
      return { status: LocalStorageMigrationStatus.NotNeeded };
    }
    await richHistoryRemoteStorage.migrate(richHistory);
    dispatch(notifyApp(createSuccessNotification('Query history successfully migrated from local storage')));
    return { status: LocalStorageMigrationStatus.Successful };
  } catch (error) {
    const errorToThrow = error instanceof Error ? error : new Error('Uknown error occurred.');
    dispatch(notifyApp(createWarningNotification(`Query history migration failed. ${errorToThrow.message}`)));
    return { status: LocalStorageMigrationStatus.Failed, error: errorToThrow };
  }
}

export const createUrlFromRichHistory = (query: RichHistoryQuery) => {
  const exploreState: ExploreUrlState = {
    /* Default range, as we are not saving timerange in rich history */
    range: { from: 'now-1h', to: 'now' },
    datasource: query.datasourceName,
    queries: query.queries,
    context: 'explore',
  };

  const serializedState = serializeStateToUrlParam(exploreState);
  const baseUrl = /.*(?=\/explore)/.exec(`${window.location.href}`)![0];
  const url = urlUtil.renderUrl(`${baseUrl}/explore`, { left: serializedState });
  return url;
};

/* Needed for slider in Rich history to map numerical values to meaningful strings */
export const mapNumbertoTimeInSlider = (num: number) => {
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

export function createDateStringFromTs(ts: number) {
  return dateTimeFormat(ts, {
    format: 'MMMM D',
  });
}

export function getQueryDisplayText(query: DataQuery): string {
  /* If datasource doesn't have getQueryDisplayText, create query display text by
   * stringifying query that was stripped of key, refId and datasource for nicer
   * formatting and improved readability
   */
  const strippedQuery = omit(query, ['key', 'refId', 'datasource']);
  return JSON.stringify(strippedQuery);
}

export function createQueryHeading(query: RichHistoryQuery, sortOrder: SortOrder) {
  let heading = '';
  if (sortOrder === SortOrder.DatasourceAZ || sortOrder === SortOrder.DatasourceZA) {
    heading = query.datasourceName;
  } else {
    heading = createDateStringFromTs(query.createdAt);
  }
  return heading;
}

export function createQueryText(query: DataQuery, dsApi?: DataSourceApi) {
  if (dsApi?.getQueryDisplayText) {
    return dsApi.getQueryDisplayText(query);
  }

  return getQueryDisplayText(query);
}

export function mapQueriesToHeadings(query: RichHistoryQuery[], sortOrder: SortOrder) {
  let mappedQueriesToHeadings: Record<string, RichHistoryQuery[]> = {};

  query.forEach((q) => {
    let heading = createQueryHeading(q, sortOrder);
    if (!(heading in mappedQueriesToHeadings)) {
      mappedQueriesToHeadings[heading] = [q];
    } else {
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
    .getList({ mixed: config.featureToggles.exploreMixedDatasource === true })
    .map((dsSettings) => {
      return {
        name: dsSettings.name,
        uid: dsSettings.uid,
      };
    });
}

export function notEmptyQuery(query: DataQuery) {
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
