import { RichHistoryQuery } from 'app/types';
import RichHistoryStorage, { RichHistoryStorageWarningDetails } from './richHistoryStorage';

/**
 * Object responsible for storing rich history to remote storage. To be implemented for Rich History migration to backend.
 */
export default class RichHistoryRemoteStorage implements RichHistoryStorage {
  async getRichHistory(): Promise<RichHistoryQuery[]> {
    return [];
  }

  async addToRichHistory(updatedHistory: RichHistoryQuery): Promise<RichHistoryStorageWarningDetails | undefined> {
    return;
  }

  async deleteAll(): Promise<void> {}

  async deleteRichHistory(id: number): Promise<void> {}

  async updateComment(id: number, comment: string): Promise<void> {}

  async updateStarred(id: number, starred: boolean): Promise<void> {}
}
