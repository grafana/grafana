import { StorageLocation } from '../StorageLocations.types';

export interface RemoveStorageLocationModalProps {
  location: StorageLocation | null;
  isVisible: boolean;
  loading: boolean;
  onDelete: (location: StorageLocation | null, force: boolean) => void;
  setVisible: (value: boolean) => void;
}
