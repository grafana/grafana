export enum LocationType {
  S3 = 'S3',
  CLIENT = 'Local Client',
}

export interface StorageLocation {
  locationID: string;
  name: string;
  description: string;
  type: LocationType;
  path: string;
}

export interface S3Location extends StorageLocation {
  accessKey: string;
  secretKey: string;
  bucketName: string;
}

interface S3ConfigResponse {
  endpoint: string;
  access_key: string;
  secret_key: string;
  bucket_name: string;
}

interface FSConfigResponse {
  path: string;
}

export interface StorageLocationReponse {
  location_id?: string;
  name: string;
  description: string;
  s3_config?: S3ConfigResponse;
  filesystem_config?: FSConfigResponse;
}

export interface StorageLocationListReponse {
  locations: StorageLocationReponse[];
}
