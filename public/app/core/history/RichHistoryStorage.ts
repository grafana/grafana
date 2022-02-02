import { RichHistoryQuery } from '../../types';

/**
 * Errors are used when the operation on Rich History was not successful.
 */
export enum RichHistoryServiceError {
  StorageFull = 'StorageFull',
  DuplicatedEntry = 'DuplicatedEntry',
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

/**
 * @internal
 * @alpha
 */
export default interface RichHistoryStorage {
  getRichHistory(): Promise<RichHistoryQuery[]>;
  addToRichHistory(richHistoryQuery: RichHistoryQuery): Promise<RichHistoryStorageWarningDetails | undefined>;
  deleteAll(): Promise<void>;
  deleteRichHistory(id: number): Promise<void>;
  updateStarred(id: number, starred: boolean): Promise<void>;
  updateComment(id: number, comment: string | undefined): Promise<void>;
}
