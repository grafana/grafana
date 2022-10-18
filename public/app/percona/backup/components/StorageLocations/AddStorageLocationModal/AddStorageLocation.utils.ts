import { StorageLocation, LocationType, S3Location } from '../StorageLocations.types';

import { AddStorageLocationFormProps } from './AddStorageLocationModal.types';

export const toStorageLocation = (values: AddStorageLocationFormProps): StorageLocation => {
  const { name, description, type, endpoint, client, accessKey, secretKey, bucketName, locationID = '' } = values;
  const locationMap: Record<typeof LocationType[keyof typeof LocationType], StorageLocation | S3Location> = {
    [LocationType.S3]: {
      locationID,
      name,
      description,
      type,
      path: endpoint,
      accessKey,
      secretKey,
      bucketName,
    },
    [LocationType.CLIENT]: {
      locationID,
      name,
      description,
      type,
      path: client,
    },
  };

  return locationMap[type];
};

export const toFormStorageLocation = (values: StorageLocation | S3Location | null): AddStorageLocationFormProps => {
  if (!values) {
    return {
      locationID: '',
      name: '',
      description: '',
      type: LocationType.S3,
      endpoint: '',
      client: '',
      accessKey: '',
      secretKey: '',
      bucketName: '',
    };
  }

  const { name, description, type, path, locationID } = values;
  const locationMap: Record<typeof LocationType[keyof typeof LocationType], AddStorageLocationFormProps> = {
    [LocationType.S3]: {
      locationID,
      name,
      description,
      type,
      endpoint: path,
      accessKey: (values as S3Location).accessKey,
      secretKey: (values as S3Location).secretKey,
      bucketName: (values as S3Location).bucketName,
      client: '',
    },
    [LocationType.CLIENT]: {
      locationID,
      name,
      description,
      type,
      endpoint: '',
      accessKey: '',
      secretKey: '',
      bucketName: '',
      client: path,
    },
  };

  return locationMap[type];
};
