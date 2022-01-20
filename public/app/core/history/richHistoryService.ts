import { RichHistoryQuery } from '../../types';

export default interface RichHistoryService {
  getRichHistory(): Promise<RichHistoryQuery[]>;

  purgeQueries(richHistory: RichHistoryQuery[]): Promise<RichHistoryQuery[]>;

  checkLimits(queriesToKeep: RichHistoryQuery[]): Promise<void>;

  addToRichHistory(updatedHistory: RichHistoryQuery[]): Promise<void>;

  deleteAll(): Promise<void>;

  deleteRichHistory(updatedHistory: RichHistoryQuery[]): Promise<void>;

  updateStarred(updatedHistory: RichHistoryQuery[]): Promise<void>;

  updateComment(updatedHistory: RichHistoryQuery[]): Promise<void>;
}
