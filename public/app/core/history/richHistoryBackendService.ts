import { RichHistoryQuery } from 'app/types';
import RichHistoryService from './richHistoryService';

export default class RichHistoryBackendService implements RichHistoryService {
  async getRichHistory(): Promise<RichHistoryQuery[]> {
    return [];
  }

  addToRichHistory(newRichHistory: RichHistoryQuery, currentRichHistory: RichHistoryQuery[]): Promise<void> {
    return Promise.resolve(undefined);
  }

  checkLimits(queriesToKeep: RichHistoryQuery[]): Promise<void> {
    return Promise.resolve(undefined);
  }

  purgeQueries(richHistory: RichHistoryQuery[]): Promise<RichHistoryQuery[]> {
    return Promise.resolve(richHistory);
  }

  async deleteAll(): Promise<void> {
    return;
  }

  async deleteRichHistory(ts: number, updatedHistory: RichHistoryQuery[]): Promise<void> {
    return;
  }
}
