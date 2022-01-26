import RichHistoryStorage, {
  RichHistoryServiceError,
  RichHistoryStorageWarning,
  RichHistoryStorageWarningDetails,
} from './richHistoryStorage';
import { RichHistoryQuery } from '../../types';
import store from '../store';
import { DataQuery } from '@grafana/data';
import { createRetentionPeriodBoundary, MAX_HISTORY_ITEMS, RICH_HISTORY_SETTING_KEYS } from '../utils/richHistory';
import { isEqual, omit } from 'lodash';

export const RICH_HISTORY_KEY = 'grafana.explore.richHistory';

/**
 * Local storage implementation for Rich History. It keeps all entries in Browser's local storage.
 */
export default class RichHistoryLocalStorage implements RichHistoryStorage {
  /**
   * Return all history entries, perform migration and clean up entries not matching retention policy.
   */
  async getRichHistory(): Promise<RichHistoryQuery[]> {
    const richHistory: RichHistoryQuery[] = store.getObject(RICH_HISTORY_KEY, []);
    const transformedRichHistory = migrateRichHistory(richHistory);
    return this.cleanUp(transformedRichHistory);
  }

  /**
   * Removes entries that do not match retention policy criteria.
   */
  private cleanUp(richHistory: RichHistoryQuery[]): RichHistoryQuery[] {
    const retentionPeriod: number = store.getObject(RICH_HISTORY_SETTING_KEYS.retentionPeriod, 7);
    const retentionPeriodLastTs = createRetentionPeriodBoundary(retentionPeriod, false);

    /* Keep only queries, that are within the selected retention period or that are starred.
     * If no queries, initialize with empty array
     */
    const queriesToKeep = richHistory.filter((q) => q.ts > retentionPeriodLastTs || q.starred === true) || [];

    store.setObject(RICH_HISTORY_KEY, queriesToKeep);
    return queriesToKeep;
  }

  /**
   * Ensures the entry can be added. Throws an error if current limit has been hit.
   * Returns queries that should be saved back giving space for one extra query.
   */
  private checkLimits(
    queriesToKeep: RichHistoryQuery[]
  ): { queriesToKeep: RichHistoryQuery[]; limitExceeded: boolean } {
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

  async addToRichHistory(richHistoryQuery: RichHistoryQuery): Promise<RichHistoryStorageWarningDetails | undefined> {
    let richHistory = await this.getRichHistory();

    /* Compare queries of a new query and last saved queries. If they are the same, (except selected properties,
     * which can be different) don't save it in rich history.
     */
    const newQueriesToCompare = richHistoryQuery.queries.map((q) => omit(q, ['key', 'refId']));
    const lastQueriesToCompare =
      richHistory.length > 0 &&
      richHistory[0].queries.map((q) => {
        return omit(q, ['key', 'refId']);
      });

    if (isEqual(newQueriesToCompare, lastQueriesToCompare)) {
      const error = new Error('Entry already exists');
      error.name = 'DuplicatedEntry';
      throw error;
    }

    const { queriesToKeep, limitExceeded } = this.checkLimits(richHistory);

    let updatedHistory: RichHistoryQuery[] = [richHistoryQuery, ...queriesToKeep];

    try {
      store.setObject(RICH_HISTORY_KEY, updatedHistory);
    } catch (error) {
      if (error.name === 'QuotaExceededError') {
        throwError(RichHistoryServiceError.StorageFull, `Saving rich history failed: ${error.message}`);
      } else if (limitExceeded) {
        return {
          type: RichHistoryStorageWarning.LimitExceeded,
          message: `Query history reached the limit of ${MAX_HISTORY_ITEMS}. Old, not-starred items have been removed.`,
        };
      } else {
        throw error;
      }
    }

    return;
  }

  async deleteAll(): Promise<void> {
    store.delete(RICH_HISTORY_KEY);
  }

  async deleteRichHistory(id: number): Promise<void> {
    const richHistory: RichHistoryQuery[] = store.getObject(RICH_HISTORY_KEY, []);
    const updatedHistory = richHistory.filter((query) => query.ts !== id);
    store.setObject(RICH_HISTORY_KEY, updatedHistory);
  }

  async updateStarred(id: number, starred: boolean): Promise<void> {
    const richHistory: RichHistoryQuery[] = store.getObject(RICH_HISTORY_KEY, []);
    const updatedHistory = richHistory.map((query) => {
      if (query.ts === id) {
        query.starred = starred;
      }
      return query;
    });

    store.setObject(RICH_HISTORY_KEY, updatedHistory);
  }

  async updateComment(id: number, comment: string): Promise<void> {
    const richHistory: RichHistoryQuery[] = store.getObject(RICH_HISTORY_KEY, []);
    const updatedHistory = richHistory.map((query) => {
      if (query.ts === id) {
        query.comment = comment;
      }
      return query;
    });
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

function throwError(name: string, message: string) {
  const error = new Error(message);
  error.name = name;
  throw error;
}
