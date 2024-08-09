import { omit } from 'lodash';

import { DataQuery, DataSourceApi, dateTimeFormat, ExploreUrlState, urlUtil } from '@grafana/data';
import { serializeStateToUrlParam } from '@grafana/data/src/utils/url';
import { getDataSourceSrv } from '@grafana/runtime';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification, createWarningNotification } from 'app/core/copy/appNotification';
import { t } from 'app/core/internationalization';
import { dispatch } from 'app/store/store';
import { RichHistoryQuery } from 'app/types/explore';

import {
  RichHistoryResults,
  RichHistoryServiceError,
  RichHistoryStorageWarning,
  RichHistoryStorageWarningDetails,
} from '../history/RichHistoryStorage';
import { createRetentionPeriodBoundary } from '../history/richHistoryLocalStorageUtils';
import { getLocalRichHistoryStorage, getRichHistoryStorage } from '../history/richHistoryStorageProvider';
import { contextSrv } from '../services/context_srv';

import {
  RichHistorySearchBackendFilters,
  RichHistorySearchFilters,
  RichHistorySettings,
  SortOrder,
} from './richHistoryTypes';

export { type RichHistorySearchFilters, type RichHistorySettings, SortOrder };

/*
 * Add queries to rich history. Save only queries within the retention period, or that are starred.
 * Side-effect: store history in local storage
 */

type addToRichHistoryParams = {
  localOverride: boolean;
  datasource: { uid: string; name?: string };
  queries: DataQuery[];
  starred: boolean;
  comment?: string;
  showNotif?: {
    quotaExceededError?: boolean;
    limitExceededWarning?: boolean;
    otherErrors?: boolean;
  };
};

export async function addToRichHistory(
  params: addToRichHistoryParams
): Promise<{ richHistoryStorageFull?: boolean; limitExceeded?: boolean }> {
  const { queries, localOverride, datasource, starred, comment, showNotif } = params;
  // default showing of errors to true
  const showQuotaExceededError = showNotif?.quotaExceededError ?? true;
  const showLimitExceededWarning = showNotif?.limitExceededWarning ?? true;
  const showOtherErrors = showNotif?.otherErrors ?? true;
  /* Save only queries, that are not falsy (e.g. empty object, null, ...) */
  const newQueriesToSave: DataQuery[] = queries && queries.filter((query) => notEmptyQuery(query));

  if (newQueriesToSave.length > 0) {
    let richHistoryStorageFull = false;
    let limitExceeded = false;
    let warning: RichHistoryStorageWarningDetails | undefined;

    try {
      // for autocomplete we want to ensure writing to local storage
      const storage = localOverride ? getLocalRichHistoryStorage() : getRichHistoryStorage();
      const result = await storage.addToRichHistory({
        datasourceUid: datasource.uid,
        datasourceName: datasource.name ?? '',
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
        } else if (showOtherErrors && error.name !== RichHistoryServiceError.DuplicatedEntry) {
          dispatch(
            notifyApp(
              createErrorNotification(
                t('explore.rich-history-utils-notification.update-failed', 'Rich History update failed'),
                error.message
              )
            )
          );
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
  // Transforming from frontend filters where from and to are days from now to absolute timestamps.
  const filtersCopy: RichHistorySearchBackendFilters = {
    ...filters,
    from:
      filters.to === undefined
        ? filters.to
        : createRetentionPeriodBoundary(filters.to, {
            isLastTs: true,
            tz: contextSrv.user?.timezone,
          }),
    to:
      filters.from === undefined
        ? filters.from
        : createRetentionPeriodBoundary(filters.from, { isLastTs: true, tz: contextSrv.user?.timezone }),
  };
  return await getRichHistoryStorage().getRichHistory(filtersCopy);
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
      dispatch(
        notifyApp(
          createErrorNotification(
            t('explore.rich-history-utils-notification.saving-failed', 'Saving rich history failed'),
            error.message
          )
        )
      );
    }
    return undefined;
  }
}

export async function updateCommentInRichHistory(id: string, newComment: string | undefined) {
  try {
    return await getRichHistoryStorage().updateComment(id, newComment);
  } catch (error) {
    if (error instanceof Error) {
      dispatch(
        notifyApp(
          createErrorNotification(
            t('explore.rich-history-utils-notification.saving-failed', 'Saving rich history failed'),
            error.message
          )
        )
      );
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
      dispatch(
        notifyApp(
          createErrorNotification(
            t('explore.rich-history-utils-notification.saving-failed', 'Saving rich history failed'),
            error.message
          )
        )
      );
    }
    return undefined;
  }
}

export const createUrlFromRichHistory = (query: RichHistoryQuery) => {
  const exploreState: ExploreUrlState = {
    /* Default range, as we are not saving timerange in rich history */
    range: {
      from: t('explore.rich-history-utils.default-from', 'now-1h'),
      to: t('explore.rich-history-utils.default-to', 'now'),
    },
    datasource: query.datasourceName,
    queries: query.queries,
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
      str = t('explore.rich-history-utils.today', 'today');
      break;
    case 1:
      str = t('explore.rich-history-utils.yesterday', 'yesterday');
      break;
    case 7:
      str = t('explore.rich-history-utils.a-week-ago', 'a week ago');
      break;
    case 14:
      str = t('explore.rich-history-utils.two-weeks-ago', 'two weeks ago');
      break;
    default:
      str = t('explore.rich-history-utils.days-ago', '{{num}} days ago', { num: `${num}` });
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
    .getList({ mixed: true })
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
