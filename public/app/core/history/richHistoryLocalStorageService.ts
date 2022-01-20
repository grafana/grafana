import RichHistoryService from './richHistoryService';
import { RichHistoryQuery } from '../../types';
import store from '../store';
import { DataQuery } from '@grafana/data';
import { createRetentionPeriodBoundary, MAX_HISTORY_ITEMS, RICH_HISTORY_SETTING_KEYS } from '../utils/richHistory';

export const RICH_HISTORY_KEY = 'grafana.explore.richHistory';

export default class RichHistoryLocalStorageService implements RichHistoryService {
  async getRichHistory(): Promise<RichHistoryQuery[]> {
    const richHistory: RichHistoryQuery[] = store.getObject(RICH_HISTORY_KEY, []);
    const transformedRichHistory = migrateRichHistory(richHistory);
    return transformedRichHistory;
  }

  async purgeQueries(richHistory: RichHistoryQuery[]): Promise<RichHistoryQuery[]> {
    const retentionPeriod: number = store.getObject(RICH_HISTORY_SETTING_KEYS.retentionPeriod, 7);
    const retentionPeriodLastTs = createRetentionPeriodBoundary(retentionPeriod, false);

    /* Keep only queries, that are within the selected retention period or that are starred.
     * If no queries, initialize with empty array
     */
    const queriesToKeep = richHistory.filter((q) => q.ts > retentionPeriodLastTs || q.starred === true) || [];

    return queriesToKeep;
  }

  async checkLimits(queriesToKeep: RichHistoryQuery[]): Promise<void> {
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

    if (limitExceeded) {
      const storageError = new Error(
        `Query history reached the limit of ${MAX_HISTORY_ITEMS}. Old, not-starred items will be removed.`
      );
      storageError.name = 'LimitExceeded';
      throw storageError;
    }
  }

  async addToRichHistory(currentRichHistory: RichHistoryQuery[]): Promise<void> {
    try {
      store.setObject(RICH_HISTORY_KEY, currentRichHistory);
    } catch (error) {
      if (error.name === 'QuotaExceededError') {
        const storageError = new Error(`Saving rich history failed: ${error.message}`);
        storageError.name = 'StorageFull';
        throw storageError;
      } else {
        throw error;
      }
    }
  }

  async deleteAll(): Promise<void> {
    store.delete(RICH_HISTORY_KEY);
  }

  async deleteRichHistory(updatedHistory: RichHistoryQuery[]): Promise<void> {
    store.setObject(RICH_HISTORY_KEY, updatedHistory);
  }

  async updateStarred(updatedHistory: RichHistoryQuery[]): Promise<void> {
    store.setObject(RICH_HISTORY_KEY, updatedHistory);
  }

  async updateComment(updatedHistory: RichHistoryQuery[]): Promise<void> {
    store.setObject(RICH_HISTORY_KEY, updatedHistory);
  }
}

function migrateRichHistory(richHistory: RichHistoryQuery[]) {
  const transformedRichHistory = richHistory.map((query) => {
    const transformedQueries: DataQuery[] = query.queries.map((q, index) => createDataQuery(query, q, index));
    return { ...query, queries: transformedQueries };
  });

  return transformedRichHistory;
}

function createDataQuery(query: RichHistoryQuery, individualQuery: DataQuery | string, index: number) {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVXYZ';
  if (typeof individualQuery === 'object') {
    // the current format
    return individualQuery;
  } else if (isParsable(individualQuery)) {
    // ElasticSearch (maybe other datasoures too) before grafana7
    return JSON.parse(individualQuery);
  }
  // prometehus (maybe other datasources too) before grafana7
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
