/**
 * Track folders deleted in the current client session so restore can avoid
 * revalidating origins that are already known to be gone.
 * This is intentionally session-scoped and only cleared on full page reload.
 */
class DeletedFoldersState {
  private deletedFolderUIDs = new Set<string>();

  markDeleted(folderUIDs: string | string[]): void {
    const values = Array.isArray(folderUIDs) ? folderUIDs : [folderUIDs];

    for (const folderUID of values) {
      if (folderUID) {
        this.deletedFolderUIDs.add(folderUID);
      }
    }
  }

  isDeleted(folderUID?: string): boolean {
    return Boolean(folderUID && this.deletedFolderUIDs.has(folderUID));
  }

  clear(): void {
    this.deletedFolderUIDs.clear();
  }
}

export const deletedFoldersState = new DeletedFoldersState();
