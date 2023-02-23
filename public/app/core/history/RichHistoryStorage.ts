import { RichHistorySearchFilters, RichHistorySettings } from 'app/core/utils/richHistory';

import { RichHistoryQuery } from '../../types';

/**
 * Errors are used when the operation on Rich History was not successful.
 */
export enum RichHistoryServiceError {
  StorageFull = 'StorageFull',
}

/**
 * Warnings are used when an entry has been added but there are some side effects that user should be informed about.
 */
export enum RichHistoryStorageWarning {
  /**
   * Returned when an entry was successfully added but maximum items limit has been reached and old entries have been removed.
   */
  LimitExceeded = 'LimitExceeded',
}

/**
 * Detailed information about the warning that can be shown to the user
 */
export type RichHistoryStorageWarningDetails = {
  type: RichHistoryStorageWarning;
  message: string;
};

export type RichHistoryResults = { richHistory: RichHistoryQuery[]; total?: number };

export type RichHistoryBaseEntry = Omit<
  RichHistoryQuery,
  'id' | 'createdAt' | 'lastExecutedAt' | 'comment' | 'starred'
>;

/**
 * @internal
 * @alpha
 */
export default interface RichHistoryStorage {
  getRichHistory(filters: RichHistorySearchFilters): Promise<RichHistoryResults>;

  /**
   * Adds a new entry to RichHistory. If the history contains an entry with the same queries, lastExecutedAt is updated instead.
   */
  addToRichHistory(
    newRichHistoryEntry: RichHistoryBaseEntry
  ): Promise<{ warning?: RichHistoryStorageWarningDetails; richHistoryQuery: RichHistoryQuery }>;

  deleteAll(): Promise<void>;
  deleteRichHistory(id: string): Promise<void>;
  updateStarred(id: string, starred: boolean): Promise<RichHistoryQuery>;
  updateComment(id: string, comment: string | undefined): Promise<RichHistoryQuery>;

  getSettings(): Promise<RichHistorySettings>;
  updateSettings(settings: RichHistorySettings): Promise<void>;
}
