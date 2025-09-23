import { SelectableValue } from '@grafana/data';
import { ApiVerboseError } from 'app/percona/shared/core';

import { StorageLocation } from '../../StorageLocations/StorageLocations.types';
import { Backup, Timeranges } from '../BackupInventory.types';

export interface RestoreBackupModalProps {
  isVisible: boolean;
  backup: Backup | null;
  noService?: boolean;
  restoreErrors?: ApiVerboseError[];
  location?: StorageLocation;
  onClose: () => void;
  onRestore: (serviceId: string, artifactId: string, pitrTimestamp?: string) => Promise<void>;
}

export interface RestoreBackupFormProps {
  serviceType: ServiceTypeSelect;
  vendor: string;
  service: SelectableValue<string>;
  dataModel: string;
  timerange?: Timeranges;
}

export enum ServiceTypeSelect {
  SAME = 'SAME',
  COMPATIBLE = 'COMPATIBLE',
}
