import { LocationType } from './StorageLocations.types';
import { isS3Location, formatLocationList, formatToRawLocation } from './StorageLocations.utils';
const s3Location = {
    locationID: 'location_1',
    bucketName: 'bucket',
    name: 's3',
    description: 'description',
    type: LocationType.S3,
    path: 's3://bla',
    secretKey: 'secret',
    accessKey: 'access',
};
const fsLocation = {
    locationID: 'location_2',
    name: 'client_fs',
    description: 'description',
    type: LocationType.CLIENT,
    path: '/foo/bar',
};
const rawS3Location = {
    location_id: 'location_3',
    name: 'first location',
    description: 'description_1',
    s3_config: {
        endpoint: 's3://foo/bar',
        access_key: 'access',
        secret_key: 'secret',
        bucket_name: 'bucket',
    },
};
const rawFSLocation = {
    location_id: 'location_4',
    name: 'second location',
    description: 'description_2',
    filesystem_config: {
        path: '/foo/bar',
    },
};
describe('StorageLocationsUtils', () => {
    it('should infer if location is of S3 type', () => {
        expect(isS3Location(s3Location)).toBeTruthy();
        expect(isS3Location(fsLocation)).toBeFalsy();
    });
    it('should correctly convert raw format to StorageLocation array', () => {
        var _a, _b, _c, _d, _e;
        const locations = formatLocationList({ locations: [rawS3Location, rawFSLocation] });
        expect(locations).toHaveLength(2);
        expect(locations[0]).toEqual({
            locationID: rawS3Location.location_id,
            name: rawS3Location.name,
            description: rawS3Location.description,
            type: LocationType.S3,
            path: (_a = rawS3Location.s3_config) === null || _a === void 0 ? void 0 : _a.endpoint,
            accessKey: (_b = rawS3Location.s3_config) === null || _b === void 0 ? void 0 : _b.access_key,
            secretKey: (_c = rawS3Location.s3_config) === null || _c === void 0 ? void 0 : _c.secret_key,
            bucketName: (_d = rawS3Location.s3_config) === null || _d === void 0 ? void 0 : _d.bucket_name,
        });
        expect(locations[1]).toEqual({
            locationID: rawFSLocation.location_id,
            name: rawFSLocation.name,
            description: rawFSLocation.description,
            type: LocationType.CLIENT,
            path: (_e = rawFSLocation.filesystem_config) === null || _e === void 0 ? void 0 : _e.path,
        });
    });
    it('should correctly convert to raw StorageLocationResponse', () => {
        expect(formatToRawLocation(s3Location)).toEqual({
            location_id: s3Location.locationID,
            name: s3Location.name,
            description: s3Location.description,
            s3_config: {
                endpoint: s3Location.path,
                access_key: s3Location.accessKey,
                secret_key: s3Location.secretKey,
                bucket_name: s3Location.bucketName,
            },
        });
        expect(formatToRawLocation(fsLocation)).toEqual({
            location_id: fsLocation.locationID,
            name: fsLocation.name,
            description: fsLocation.description,
            filesystem_config: {
                path: fsLocation.path,
            },
        });
        expect(formatToRawLocation(Object.assign(Object.assign({}, fsLocation), { type: LocationType.CLIENT }))).toEqual({
            location_id: fsLocation.locationID,
            name: fsLocation.name,
            description: fsLocation.description,
            filesystem_config: {
                path: fsLocation.path,
            },
        });
    });
});
//# sourceMappingURL=StorageLocations.utils.test.js.map