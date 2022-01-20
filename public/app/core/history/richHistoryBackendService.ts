import { RichHistoryQuery } from 'app/types';
import RichHistoryService from './richHistoryService';

export default class RichHistoryBackendService implements RichHistoryService {
  async getRichHistory(): Promise<RichHistoryQuery[]> {
    return [];
  }

  async addToRichHistory(updatedHistory: RichHistoryQuery[]): Promise<void> {}

  checkLimits(queriesToKeep: RichHistoryQuery[]): Promise<void> {
    return Promise.resolve(undefined);
  }

  purgeQueries(richHistory: RichHistoryQuery[]): Promise<RichHistoryQuery[]> {
    return Promise.resolve(richHistory);
  }

  async deleteAll(): Promise<void> {}

  async deleteRichHistory(updatedHistory: RichHistoryQuery[]): Promise<void> {}

  async updateComment(updatedHistory: RichHistoryQuery[]): Promise<void> {}

  async updateStarred(updatedHistory: RichHistoryQuery[]): Promise<void> {}
}
