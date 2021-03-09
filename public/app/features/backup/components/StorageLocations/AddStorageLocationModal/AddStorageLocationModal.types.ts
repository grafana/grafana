import { LocationType, StorageLocation } from '../StorageLocations.types';

export interface AddStorageLocationModalProps {
  isVisible: boolean;
  location: StorageLocation | null;
  onClose: () => void;
  onAdd: (location: StorageLocation) => void;
}

export interface AddStorageLocationFormProps {
  locationID?: string;
  name: string;
  description: string;
  type: LocationType;
  endpoint: string;
  client: string;
  server: string;
  accessKey: string;
  secretKey: string;
  bucketName: string;
}

export interface TypeFieldProps {
  values: AddStorageLocationFormProps;
}
