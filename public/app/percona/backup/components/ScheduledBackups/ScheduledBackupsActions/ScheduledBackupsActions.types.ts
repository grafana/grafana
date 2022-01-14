import { ScheduledBackup } from '../ScheduledBackups.types';

export interface ScheduledBackupsActionsProps {
  backup: ScheduledBackup;
  onEdit?: (backup: ScheduledBackup) => void;
  onDelete?: (backup: ScheduledBackup) => void;
  onCopy?: (backup: ScheduledBackup) => void;
  onToggle?: (backup: ScheduledBackup) => void;
  pending?: boolean;
}
