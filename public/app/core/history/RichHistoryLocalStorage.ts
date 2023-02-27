import { find, isEqual, omit } from 'lodash';

import { SelectableValue } from '@grafana/data';
import { DataQuery } from '@grafana/schema';
import { RichHistorySearchFilters, RichHistorySettings } from 'app/core/utils/richHistory';

import { RichHistoryQuery } from '../../types';
import store from '../store';

import RichHistoryStorage, {
  RichHistoryBaseEntry,
  RichHistoryServiceError,
  RichHistoryStorageWarning,
} from './RichHistoryStorage';
import { fromDTO, toDTO } from './localStorageConverter';
import {
  createRetentionPeriodBoundary,
  filterAndSortQueries,
  RICH_HISTORY_SETTING_KEYS,
} from './richHistoryLocalStorageUtils';

export const RICH_HISTORY_KEY = 'grafana.explore.richHistory';
export const MAX_HISTORY_ITEMS = 10000;

const removeUniqueProperties = (query: DataQuery) => omit(query, ['key', 'refId']);

/**
 * DTO for storing rich history in local storage.
 */
export type RichHistoryLocalStorageDTO = {
  // works as an unique identifier
  ts: number;
  /**
   * Last time the query was executed.
   * It may be undefined for entries created before we started keeping track of
   * execution time.
   */
  lastExecutedAt?: number;
  datasourceName: string;
  starred: boolean;
  comment: string;
  queries: DataQuery[];
};

/**
 * Local storage implementation for Rich History. It keeps all entries in browser's local storage.
 */
export default class RichHistoryLocalStorage implements RichHistoryStorage {
  /**
   * Return history entries based on provided filters, perform migration and clean up entries not matching retention policy.
   */
  async getRichHistory(filters: RichHistorySearchFilters) {
    const allQueries = getRichHistoryDTOs().map(fromDTO);
    const queries = filters.starred ? allQueries.filter((q) => q.starred === true) : allQueries;

    const richHistory = filterAndSortQueries(queries, filters.sortOrder, filters.datasourceFilters, filters.search, [
      filters.from,
      filters.to,
    ]);
    return { richHistory, total: richHistory.length };
  }

  async addToRichHistory(newEntry: RichHistoryBaseEntry) {
    const ts = Date.now();
    const history = getRichHistoryDTOs();

    // we need to cleanup the new entry from properties that we don't want to take into account when comparing against entries in local storage.
    const baseQuery = omit({ ...newEntry, queries: newEntry.queries.map(removeUniqueProperties) }, [
      'lastExecutedAt',
      'starred',
      'ts',
      'comment',
      'datasourceUid',
    ]);

    let richHistoryQuery: RichHistoryQuery;

    const existingMatchingEntryIndex = history.findIndex((historyItem) => {
      return isEqual(
        omit({ ...historyItem, queries: historyItem.queries.map(removeUniqueProperties) }, [
          'lastExecutedAt',
          'starred',
          'ts',
          'comment',
        ]),
        baseQuery
      );
    });

    if (existingMatchingEntryIndex >= 0) {
      // an entry exists, remove it from the list.
      const current = history.splice(existingMatchingEntryIndex, 1)[0];

      richHistoryQuery = {
        ...current,
        id: ts.toString(),
        createdAt: current.ts,
        lastExecutedAt: ts,
        datasourceUid: newEntry.datasourceUid,
      };
    } else {
      // no entry is found
      richHistoryQuery = {
        ...newEntry,
        id: ts.toString(),
        createdAt: ts,
        lastExecutedAt: ts,
        starred: false,
        comment: '',
      };
    }

    // finally add the new entry to the top of the history
    history.unshift(toDTO(richHistoryQuery));

    const limitExceeded = pruneExceeding(history);

    try {
      store.setObject(RICH_HISTORY_KEY, cleanUp(history));
    } catch (error) {
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        throwError(RichHistoryServiceError.StorageFull, `Saving rich history failed: ${error.message}`);
      } else {
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
  }

  async deleteAll() {
    store.delete(RICH_HISTORY_KEY);
  }

  async deleteRichHistory(id: string) {
    const ts = parseInt(id, 10);
    const richHistory: RichHistoryLocalStorageDTO[] = store.getObject(RICH_HISTORY_KEY, []);
    const updatedHistory = richHistory.filter((query) => query.ts !== ts);
    store.setObject(RICH_HISTORY_KEY, updatedHistory);
  }

  async updateStarred(id: string, starred: boolean) {
    return updateRichHistory(id, (richHistoryDTO) => (richHistoryDTO.starred = starred));
  }

  async updateComment(id: string, comment: string) {
    return updateRichHistory(id, (richHistoryDTO) => (richHistoryDTO.comment = comment));
  }

  async getSettings() {
    return {
      activeDatasourceOnly: store.getObject(RICH_HISTORY_SETTING_KEYS.activeDatasourceOnly, false),
      retentionPeriod: store.getObject(RICH_HISTORY_SETTING_KEYS.retentionPeriod, 7),
      starredTabAsFirstTab: store.getBool(RICH_HISTORY_SETTING_KEYS.starredTabAsFirstTab, false),
      lastUsedDatasourceFilters: store
        .getObject(RICH_HISTORY_SETTING_KEYS.datasourceFilters, [])
        .map((selectableValue: SelectableValue) => selectableValue.value),
    };
  }

  async updateSettings(settings: RichHistorySettings) {
    store.set(RICH_HISTORY_SETTING_KEYS.activeDatasourceOnly, settings.activeDatasourceOnly);
    store.set(RICH_HISTORY_SETTING_KEYS.retentionPeriod, settings.retentionPeriod);
    store.set(RICH_HISTORY_SETTING_KEYS.starredTabAsFirstTab, settings.starredTabAsFirstTab);
    store.setObject(
      RICH_HISTORY_SETTING_KEYS.datasourceFilters,
      (settings.lastUsedDatasourceFilters || []).map((datasourceName: string) => {
        return { value: datasourceName };
      })
    );
  }
}

function updateRichHistory(
  id: string,
  updateCallback: (richHistoryDTO: RichHistoryLocalStorageDTO) => void
): RichHistoryQuery {
  const ts = parseInt(id, 10);
  const richHistoryDTOs: RichHistoryLocalStorageDTO[] = store.getObject(RICH_HISTORY_KEY, []);
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
function cleanUp(richHistory: RichHistoryLocalStorageDTO[]): RichHistoryLocalStorageDTO[] {
  const retentionPeriod: number = store.getObject(RICH_HISTORY_SETTING_KEYS.retentionPeriod, 7);
  const retentionPeriodLastTs = createRetentionPeriodBoundary(retentionPeriod, false);

  // Keep only queries that are within the selected retention period or that are starred.
  return richHistory.filter((q) => q.starred || (q.lastExecutedAt || q.ts) > retentionPeriodLastTs);
}

/**
 * Ensures the entry can be added.
 * Removes non-starred queries from the history until its length is less than or equal to `MAX_HISTORY_ITEMS`.
 *  @returns `true` if the limit was exceeded and some queries were removed.
 */
function pruneExceeding(queriesToKeep: RichHistoryLocalStorageDTO[]): boolean {
  let limitExceeded = false;
  let current = queriesToKeep.length - 1;
  while (current >= 0 && queriesToKeep.length >= MAX_HISTORY_ITEMS) {
    if (!queriesToKeep[current].starred) {
      queriesToKeep.splice(current, 1);
      limitExceeded = true;
    }
    current--;
  }

  return limitExceeded;
}

function getRichHistoryDTOs(): RichHistoryLocalStorageDTO[] {
  const richHistory: RichHistoryLocalStorageDTO[] = store.getObject(RICH_HISTORY_KEY, []);
  return migrateRichHistory(richHistory);
}

function migrateRichHistory(richHistory: RichHistoryLocalStorageDTO[]): RichHistoryLocalStorageDTO[] {
  const transformedRichHistory = richHistory.map((query) => {
    const transformedQueries: DataQuery[] = query.queries.map((q, index) => createDataQuery(query, q, index));
    return { ...query, queries: transformedQueries };
  });

  return transformedRichHistory;
}

function createDataQuery(query: RichHistoryLocalStorageDTO, individualQuery: DataQuery | string, index: number) {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVXYZ';
  if (typeof individualQuery === 'object') {
    // the current format
    return individualQuery;
  } else if (isParsable(individualQuery)) {
    // ElasticSearch (maybe other datasoures too) before grafana7
    return JSON.parse(individualQuery);
  }
  // prometheus (maybe other datasources too) before grafana7
  return { expr: individualQuery, refId: letters[index] };
}

function isParsable(string: string) {
  try {
    JSON.parse(string);
  } catch (e) {
    return false;
  }
  return true;
}

function throwError(name: string, message: string) {
  const error = new Error(message);
  error.name = name;
  throw error;
}
