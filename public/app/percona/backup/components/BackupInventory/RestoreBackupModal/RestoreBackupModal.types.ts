import { SelectableValue } from '@grafana/data';
import { Backup } from '../BackupInventory.types';

export interface RestoreBackupModalProps {
  isVisible: boolean;
  backup: Backup | null;
  onClose: () => void;
  onRestore: (serviceId: string, locationId: string, artifactId: string) => void;
}

export interface RestoreBackupFormProps {
  serviceType: ServiceTypeSelect;
  vendor: string;
  service: SelectableValue<string>;
  dataModel: string;
}

export enum ServiceTypeSelect {
  SAME = 'SAME',
  COMPATIBLE = 'COMPATIBLE',
}
