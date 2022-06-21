import { Restore } from '../RestoreHistory.types';

export interface BackupInventoryActionsProps {
  restore: Restore;
  onCancel: (restore: Restore) => void;
  onRestore: (restore: Restore) => void;
  onDelete: (restore: Restore) => void;
}
