import { LocationType } from '../StorageLocations.types';
import { toFormStorageLocation, toStorageLocation } from './AddStorageLocation.utils';
describe('AddStorageLocationUtils', () => {
    describe('toFormStorageLocation', () => {
        it('should return an empty S3 object by default', () => {
            expect(toFormStorageLocation(null)).toEqual({
                locationID: '',
                name: '',
                description: '',
                type: LocationType.S3,
                endpoint: '',
                client: '',
                accessKey: '',
                secretKey: '',
                bucketName: '',
            });
        });
        it('should convert an S3Location', () => {
            const location = {
                locationID: 'Location_1',
                name: 'S3',
                description: 'S3 location',
                path: 's3://foo',
                type: LocationType.S3,
                accessKey: 'accessKey',
                secretKey: 'secretKey',
                bucketName: 'bucket',
            };
            expect(toFormStorageLocation(location)).toEqual({
                locationID: location.locationID,
                name: location.name,
                description: location.description,
                type: LocationType.S3,
                endpoint: location.path,
                accessKey: location.accessKey,
                secretKey: location.secretKey,
                client: '',
                bucketName: 'bucket',
            });
        });
        it('should convert a local client location', () => {
            const location = {
                locationID: 'Location_1',
                name: 'Local Client',
                description: 'Client location',
                path: '/foo/bar',
                type: LocationType.CLIENT,
            };
            expect(toFormStorageLocation(location)).toEqual({
                locationID: location.locationID,
                name: location.name,
                description: location.description,
                type: LocationType.CLIENT,
                client: location.path,
                endpoint: '',
                accessKey: '',
                secretKey: '',
                bucketName: '',
            });
        });
    });
    describe('toStorageLocation', () => {
        it('should convert an S3 location', () => {
            const location = {
                locationID: 'Location1',
                name: 'S3 Location',
                description: 'location',
                type: LocationType.S3,
                endpoint: 's3://foo',
                client: '',
                accessKey: 'accessKey',
                secretKey: 'secretKey',
                bucketName: 'bucket',
            };
            expect(toStorageLocation(location)).toEqual({
                locationID: location.locationID,
                name: location.name,
                description: location.description,
                type: LocationType.S3,
                path: location.endpoint,
                accessKey: location.accessKey,
                secretKey: location.secretKey,
                bucketName: location.bucketName,
            });
        });
        it('should convert a local client location', () => {
            const location = {
                locationID: 'Location1',
                name: 'Client Location',
                description: 'client',
                type: LocationType.CLIENT,
                endpoint: '',
                client: '/foo/bar',
                accessKey: '',
                secretKey: '',
                bucketName: '',
            };
            expect(toStorageLocation(location)).toEqual({
                locationID: location.locationID,
                name: location.name,
                description: location.description,
                type: LocationType.CLIENT,
                path: location.client,
            });
        });
    });
});
//# sourceMappingURL=AddStorageLocation.utils.test.js.map