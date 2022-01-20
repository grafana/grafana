import { RichHistoryQuery } from '../../types';

export default interface RichHistoryService {
  getRichHistory(): Promise<RichHistoryQuery[]>;

  purgeQueries(richHistory: RichHistoryQuery[]): Promise<RichHistoryQuery[]>;

  checkLimits(queriesToKeep: RichHistoryQuery[]): Promise<void>;

  /**
   * Service can either saved newly added item or re-save everything.
   */
  addToRichHistory(
    newRichHistoryQuery: RichHistoryQuery,
    allRichHistoryQueries: RichHistoryQuery[]
  ): Promise<RichHistoryQuery[]>;
}
