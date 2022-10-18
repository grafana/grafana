import { Row } from 'react-table';
import { StorageLocation } from '../StorageLocations.types';

export interface StorageLocatationsActionProps {
  row: Row<StorageLocation>;
  location: StorageLocation;
  onUpdate: (location: StorageLocation) => void;
  onDelete: (location: StorageLocation) => void;
}
