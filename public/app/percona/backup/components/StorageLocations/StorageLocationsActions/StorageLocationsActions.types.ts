import { StorageLocation } from '../StorageLocations.types';

export interface StorageLocatationsActionProps {
  location: StorageLocation;
  onUpdate: (location: StorageLocation) => void;
  onDelete: (location: StorageLocation) => void;
}
