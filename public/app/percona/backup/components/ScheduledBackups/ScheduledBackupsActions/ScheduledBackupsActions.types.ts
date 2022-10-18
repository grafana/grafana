import { Row } from 'react-table';

import { ScheduledBackup } from '../ScheduledBackups.types';

export interface ScheduledBackupsActionsProps {
  row: Row<ScheduledBackup>;
  backup: ScheduledBackup;
  onEdit?: (backup: ScheduledBackup) => void;
  onDelete?: (backup: ScheduledBackup) => void;
  onCopy?: (backup: ScheduledBackup) => void;
  onToggle?: (backup: ScheduledBackup) => void;
  pending?: boolean;
}
