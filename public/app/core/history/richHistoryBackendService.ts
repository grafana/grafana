import { RichHistoryQuery } from 'app/types';
import RichHistoryService from './richHistoryService';

export default class RichHistoryBackendService implements RichHistoryService {
  async getRichHistory(): Promise<RichHistoryQuery[]> {
    return [];
  }

  addToRichHistory(
    newRichHistory: RichHistoryQuery,
    currentRichHistory: RichHistoryQuery[]
  ): Promise<RichHistoryQuery[]> {
    let updatedHistory: RichHistoryQuery[] = [newRichHistory, ...currentRichHistory];
    return Promise.resolve(updatedHistory);
  }

  checkLimits(queriesToKeep: RichHistoryQuery[]): Promise<void> {
    return Promise.resolve(undefined);
  }

  purgeQueries(richHistory: RichHistoryQuery[]): Promise<RichHistoryQuery[]> {
    return Promise.resolve(richHistory);
  }
}
