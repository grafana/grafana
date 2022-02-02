import { RichHistoryQuery } from 'app/types';
import RichHistoryStorage from './RichHistoryStorage';

/**
 * Object responsible for storing rich history to remote storage. To be implemented for Rich History migration to backend.
 */
export default class RichHistoryRemoteStorage implements RichHistoryStorage {
  async getRichHistory() {
    return [];
  }
  async addToRichHistory(richHistoryQuery: RichHistoryQuery) {
    return undefined;
  }
  async deleteAll() {}
  async deleteRichHistory(id: number) {}
  async updateComment(id: number, comment: string | undefined) {}
  async updateStarred(id: number, starred: boolean) {}
}
