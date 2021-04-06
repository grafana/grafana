import { Backup } from '../BackupInventory.types';

export interface BackupInventoryActionsProps {
  backup: Backup;
  onBackup: (backup: Backup) => void;
}
