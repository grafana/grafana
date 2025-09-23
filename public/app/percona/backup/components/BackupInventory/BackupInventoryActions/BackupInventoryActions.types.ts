import { Row } from 'react-table';

import { Backup } from '../BackupInventory.types';

export interface BackupInventoryActionsProps {
  row: Row<Backup>;
  backup: Backup;
  onRestore: (backup: Backup) => void;
  onBackup: (backup: Backup) => void;
  onDelete: (backup: Backup) => void;
}
