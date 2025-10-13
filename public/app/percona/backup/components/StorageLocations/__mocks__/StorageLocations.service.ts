import * as service from '../StorageLocations.service';
import { StorageLocationListReponse } from '../StorageLocations.types';

export const stubLocations: StorageLocationListReponse = {
  locations: [
    {
      location_id: 'location_1',
      name: 'first location',
      description: 'description_1',
      s3_config: {
        bucket_name: 'bucket',
        endpoint: 's3://foo/bar',
        access_key: 'access',
        secret_key: 'secret',
      },
    },
    {
      location_id: 'location_2',
      name: 'second location',
      description: 'description_2',
      filesystem_config: {
        path: '/path/to/server',
      },
    },
    {
      location_id: 'location_3',
      name: 'third location',
      description: 'description_3',
      filesystem_config: {
        path: '/path/to/client',
      },
    },
  ],
};

export const StorageLocationsService =
  jest.genMockFromModule<typeof service>('../StorageLocations.service').StorageLocationsService;
StorageLocationsService.list = () => Promise.resolve(stubLocations);
StorageLocationsService.delete = () => Promise.resolve();
