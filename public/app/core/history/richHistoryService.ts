import { RichHistoryQuery } from '../../types';

export default interface RichHistoryService {
  getRichHistory(): Promise<RichHistoryQuery[]>;

  purgeQueries(richHistory: RichHistoryQuery[]): Promise<RichHistoryQuery[]>;

  checkLimits(queriesToKeep: RichHistoryQuery[]): Promise<void>;

  /**
   * Service can either saved newly added item or re-save everything.
   */
  addToRichHistory(newRichHistoryQuery: RichHistoryQuery, allRichHistoryQueries: RichHistoryQuery[]): Promise<void>;

  deleteAll(): Promise<void>;

  // TODO: change "ts" to list of entries to remove
  deleteRichHistory(ts: number, updatedHistory: RichHistoryQuery[]): Promise<void>;
}
