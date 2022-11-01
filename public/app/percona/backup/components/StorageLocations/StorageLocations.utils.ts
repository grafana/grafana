/* eslint-disable @typescript-eslint/consistent-type-assertions */
import {
  S3Location,
  StorageLocation,
  StorageLocationListReponse,
  LocationType,
  StorageLocationReponse,
} from './StorageLocations.types';

export const isS3Location = (location: StorageLocation): location is S3Location => 'accessKey' in location;

export const formatLocationList = (rawList: StorageLocationListReponse): StorageLocation[] => {
  const { locations = [] } = rawList;
  const parsedLocations: StorageLocation[] = [];

  locations.forEach((location) => {
    const { location_id, name, description, filesystem_config, s3_config } = location;
    const newLocation: Partial<StorageLocation> = { name, description, locationID: location_id };

    if (s3_config) {
      const { endpoint, access_key, secret_key, bucket_name } = s3_config;
      newLocation.type = LocationType.S3;
      newLocation.path = endpoint;
      (newLocation as S3Location).accessKey = access_key;
      (newLocation as S3Location).secretKey = secret_key;
      (newLocation as S3Location).bucketName = bucket_name;
    } else if (filesystem_config) {
      newLocation.path = filesystem_config.path;
      newLocation.type = LocationType.CLIENT;
    }

    parsedLocations.push(newLocation as StorageLocation);
  });
  return parsedLocations;
};

export const formatToRawLocation = (
  location: StorageLocation | S3Location,
  stripOnlyConfig = false
): Partial<StorageLocationReponse> => {
  const { name, description, path, type, locationID } = location;
  const localObj = { path };
  const result: Partial<StorageLocationReponse> = stripOnlyConfig ? {} : { name, description, location_id: locationID };

  if (isS3Location(location)) {
    const { accessKey, secretKey, bucketName } = location;
    result.s3_config = { endpoint: path, access_key: accessKey, secret_key: secretKey, bucket_name: bucketName };
  } else if (type === LocationType.CLIENT) {
    result.filesystem_config = localObj;
  }

  return result;
};
