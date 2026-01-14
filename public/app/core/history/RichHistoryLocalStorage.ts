import { find, isEqual, omit } from 'lodash';

import { DataQuery, SelectableValue } from '@grafana/data';
import { createMonitoringLogger } from '@grafana/runtime';
import { RichHistorySearchFilters, RichHistorySettings, SortOrder } from 'app/core/utils/richHistoryTypes';
import { RichHistoryQuery } from 'app/types/explore';

import store from '../store';

import RichHistoryStorage, { RichHistoryServiceError, RichHistoryStorageWarning } from './RichHistoryStorage';
import { fromDTO, toDTO } from './localStorageConverter';
import {
  createRetentionPeriodBoundary,
  filterAndSortQueries,
  RICH_HISTORY_SETTING_KEYS,
} from './richHistoryLocalStorageUtils';

export const RICH_HISTORY_KEY = 'grafana.explore.richHistory';
export const MAX_HISTORY_ITEMS = 10000;

export type RichHistoryLocalStorageDTO = {
  // works as an unique identifier
  ts: number;
  datasourceName: string;
  starred: boolean;
  comment: string;
  queries: DataQuery[];
};

const logger = createMonitoringLogger('features.query-history.local-storage');

/**
 * Local storage implementation for Rich History. It keeps all entries in browser's local storage.
 */
export default class RichHistoryLocalStorage implements RichHistoryStorage {
  public static getLocalStorageUsageInBytes(): number {
    const richHistory: RichHistoryLocalStorageDTO[] = store.get(RICH_HISTORY_KEY) || '';
    // each character is 2 bytes
    return richHistory.length * 2;
  }

  /**
   * Return history entries based on provided filters, perform migration and clean up entries not matching retention policy.
   */
  async getRichHistory(filters: RichHistorySearchFilters) {
    const allQueries = getRichHistoryDTOs().map(fromDTO);
    const queries = filters.starred ? allQueries.filter((q) => q.starred === true) : allQueries;

    const timeFilter: [number, number] | undefined =
      filters.from && filters.to ? [filters.from, filters.to] : undefined;

    const richHistory = filterAndSortQueries(
      queries,
      filters.sortOrder,
      filters.datasourceFilters,
      filters.search,
      timeFilter
    );
    return { richHistory, total: richHistory.length };
  }

  async addToRichHistory(newRichHistoryQuery: Omit<RichHistoryQuery, 'id' | 'createdAt'>) {
    const ts = Date.now();
    const richHistoryQuery = {
      id: ts.toString(),
      createdAt: ts,
      ...newRichHistoryQuery,
    };

    const newRichHistoryQueryDTO = toDTO(richHistoryQuery);
    const currentRichHistoryDTOs = cleanUp(getRichHistoryDTOs());

    /* Compare queries of a new query and last saved queries. If they are the same, (except selected properties,
     * which can be different) don't save it in rich history.
     */
    const newQueriesToCompare = newRichHistoryQueryDTO.queries.map((q) => omit(q, ['key', 'refId']));
    const lastQueriesToCompare =
      currentRichHistoryDTOs.length > 0 &&
      currentRichHistoryDTOs[0].queries.map((q) => {
        return omit(q, ['key', 'refId']);
      });

    if (isEqual(newQueriesToCompare, lastQueriesToCompare)) {
      const error = new Error('Entry already exists');
      error.name = RichHistoryServiceError.DuplicatedEntry;
      throw error;
    }

    const { queriesToKeep, limitExceeded } = cleanUpUnstarredQuery(currentRichHistoryDTOs, MAX_HISTORY_ITEMS);

    let updatedHistory: RichHistoryLocalStorageDTO[] = [newRichHistoryQueryDTO, ...queriesToKeep];

    let saveRetriesLeft = 3;
    let saved = false;

    while (!saved && saveRetriesLeft >= 0) {
      try {
        store.setObject(RICH_HISTORY_KEY, updatedHistory);
        saved = true;
      } catch (error) {
        if (saveRetriesLeft >= 1) {
          await this.trackLocalStorageUsage('Failed to save rich history to local storage', {
            saveRetriesLeft: saveRetriesLeft.toString(),
            quotaExceededError: error instanceof Error && error.name === 'QuotaExceededError' ? 'true' : 'false',
            errorMessage: error instanceof Error ? error?.message : 'unknown',
          });

          saveRetriesLeft--;
          const { queriesToKeep } = cleanUpUnstarredQuery(updatedHistory, updatedHistory.length - 1);
          updatedHistory = queriesToKeep;
          continue;
        }

        if (error instanceof Error && error.name === 'QuotaExceededError') {
          throwError(RichHistoryServiceError.StorageFull, `Saving rich history failed: ${error.message}`);
        } else {
          throw error;
        }
      }
    }

    if (limitExceeded) {
      await this.trackLocalStorageUsage('Rich history query limit exceeded.');

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
    // get the new key without a default. If undefined, use the legacy key, or false as the default
    const activeDatasource: boolean | undefined = store.getObject(RICH_HISTORY_SETTING_KEYS.activeDatasourcesOnly);
    return {
      activeDatasourcesOnly:
        activeDatasource ?? store.getObject(RICH_HISTORY_SETTING_KEYS.legacyActiveDatasourceOnly, false),
      retentionPeriod: store.getObject(RICH_HISTORY_SETTING_KEYS.retentionPeriod, 7),
      starredTabAsFirstTab: store.getBool(RICH_HISTORY_SETTING_KEYS.starredTabAsFirstTab, false),
      lastUsedDatasourceFilters: store
        .getObject(RICH_HISTORY_SETTING_KEYS.datasourceFilters, [])
        .map((selectableValue: SelectableValue) => selectableValue.value),
    };
  }

  async updateSettings(settings: RichHistorySettings) {
    store.set(RICH_HISTORY_SETTING_KEYS.activeDatasourcesOnly, settings.activeDatasourcesOnly);
    store.set(RICH_HISTORY_SETTING_KEYS.retentionPeriod, settings.retentionPeriod);
    store.set(RICH_HISTORY_SETTING_KEYS.starredTabAsFirstTab, settings.starredTabAsFirstTab);
    store.setObject(
      RICH_HISTORY_SETTING_KEYS.datasourceFilters,
      (settings.lastUsedDatasourceFilters || []).map((datasourceName: string) => {
        return { value: datasourceName };
      })
    );
  }

  private async trackLocalStorageUsage(message: string, additionalInfo?: Record<string, string>) {
    const allQueriesCount =
      (
        await this.getRichHistory({
          search: '',
          sortOrder: SortOrder.Ascending,
          datasourceFilters: [],
          starred: false,
        })
      ).total || -1;

    const allQueriesSizeInBytes = RichHistoryLocalStorage.getLocalStorageUsageInBytes();

    const totalLocalStorageSize = calculateTotalLocalStorageSize();

    const localStats = {
      totalLocalStorageSize: totalLocalStorageSize?.toString(),
      allQueriesSizeInBytes: allQueriesSizeInBytes?.toString(),
      allQueriesCount: allQueriesCount?.toString(),
    };

    logger.logWarning(message, {
      ...localStats,
      ...additionalInfo,
    });
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
  // We don't care about timezones that much here when creating the time stamp for deletion. First, not sure if we
  // should be deleting entries based on timezone change that may serve only for querying and also the timezone
  // difference would not change that much what is or isn't deleted compared to the default 2 weeks retention.
  const retentionPeriodLastTs = createRetentionPeriodBoundary(retentionPeriod, { isLastTs: false });

  /* Keep only queries, that are within the selected retention period or that are starred.
   * If no queries, initialize with empty array
   */
  return richHistory.filter((q) => q.ts > retentionPeriodLastTs || q.starred === true) || [];
}

/**
 * Ensures the entry can be added.
 * Returns queries that should be saved back giving space for one extra query.
 */
export function cleanUpUnstarredQuery(
  queriesToKeep: RichHistoryLocalStorageDTO[],
  max: number
): {
  queriesToKeep: RichHistoryLocalStorageDTO[];
  limitExceeded: boolean;
} {
  // remove oldest non-starred items to give space for the recent query
  let limitExceeded = false;
  let current = queriesToKeep.length - 1;
  while (current >= 0 && queriesToKeep.length > max) {
    if (!queriesToKeep[current].starred) {
      queriesToKeep.splice(current, 1);
      limitExceeded = true;
    }
    current--;
  }

  return { queriesToKeep, limitExceeded };
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

function calculateTotalLocalStorageSize() {
  try {
    let total = 0;

    // eslint-disable-next-line
    const ls = window.localStorage;

    for (let i = 0; i < ls.length; i++) {
      const key = ls.key(i);
      if (key) {
        const value = ls.getItem(key);
        if (value) {
          total += key.length + value.length;
        }
      }
    }
    // each character is 2 bytes
    return total * 2;
  } catch (e) {
    return -1;
  }
}
