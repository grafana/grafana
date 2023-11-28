/* eslint-disable @typescript-eslint/consistent-type-assertions */
import { LocationType } from '../StorageLocations.types';
export const toStorageLocation = (values) => {
    const { name, description, type, endpoint, client, accessKey, secretKey, bucketName, locationID = '' } = values;
    const locationMap = {
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
export const toFormStorageLocation = (values) => {
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
    const locationMap = {
        [LocationType.S3]: {
            locationID,
            name,
            description,
            type,
            endpoint: path,
            accessKey: values.accessKey,
            secretKey: values.secretKey,
            bucketName: values.bucketName,
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
//# sourceMappingURL=AddStorageLocation.utils.js.map