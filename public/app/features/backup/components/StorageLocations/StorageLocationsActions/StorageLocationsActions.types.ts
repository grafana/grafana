import { StorageLocation } from '../StorageLocations.types';

export interface StorageLocatationsActionProps {
  location: StorageLocation;
  onDelete: (location: StorageLocation) => void;
}
