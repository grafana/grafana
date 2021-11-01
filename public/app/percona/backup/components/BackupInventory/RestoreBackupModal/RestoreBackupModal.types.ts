import { SelectableValue } from '@grafana/data';
import { ApiVerboseError } from 'app/percona/shared/core';
import { Backup } from '../BackupInventory.types';

export interface RestoreBackupModalProps {
  isVisible: boolean;
  backup: Backup | null;
  noService?: boolean;
  restoreErrors?: ApiVerboseError[];
  onClose: () => void;
  onRestore: (serviceId: string, artifactId: string) => void;
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
