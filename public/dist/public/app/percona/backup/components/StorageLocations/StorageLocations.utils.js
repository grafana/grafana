/* eslint-disable @typescript-eslint/consistent-type-assertions */
import { LocationType, } from './StorageLocations.types';
export const isS3Location = (location) => 'accessKey' in location;
export const formatLocationList = (rawList) => {
    const { locations = [] } = rawList;
    const parsedLocations = [];
    locations.forEach((location) => {
        const { location_id, name, description, filesystem_config, s3_config } = location;
        const newLocation = { name, description, locationID: location_id };
        if (s3_config) {
            const { endpoint, access_key, secret_key, bucket_name } = s3_config;
            newLocation.type = LocationType.S3;
            newLocation.path = endpoint;
            newLocation.accessKey = access_key;
            newLocation.secretKey = secret_key;
            newLocation.bucketName = bucket_name;
        }
        else if (filesystem_config) {
            newLocation.path = filesystem_config.path;
            newLocation.type = LocationType.CLIENT;
        }
        parsedLocations.push(newLocation);
    });
    return parsedLocations;
};
export const formatToRawLocation = (location, stripOnlyConfig = false) => {
    const { name, description, path, type, locationID } = location;
    const localObj = { path };
    const result = stripOnlyConfig ? {} : { name, description, location_id: locationID };
    if (isS3Location(location)) {
        const { accessKey, secretKey, bucketName } = location;
        result.s3_config = { endpoint: path, access_key: accessKey, secret_key: secretKey, bucket_name: bucketName };
    }
    else if (type === LocationType.CLIENT) {
        result.filesystem_config = localObj;
    }
    return result;
};
//# sourceMappingURL=StorageLocations.utils.js.map