import { RestoreStatus } from '../../Backup.types';
import { Backup, RawBackup } from '../BackupInventory/BackupInventory.types';

export interface RawRestore extends Omit<RawBackup, 'created_at' | 'status' | 'mode'> {
  status: RestoreStatus;
  restore_id: string;
  started_at: string;
  finished_at?: string;
  pitr_timestamp?: string;
}

export interface RestoreResponse {
  items: RawRestore[];
}

export interface Restore extends Omit<Backup, 'created' | 'status' | 'mode'> {
  artifactId: string;
  started: number;
  finished: number | null;
  status: RestoreStatus;
  pitrTimestamp?: number;
}
