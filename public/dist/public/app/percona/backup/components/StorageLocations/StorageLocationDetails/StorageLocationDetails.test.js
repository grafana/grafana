import { render, screen } from '@testing-library/react';
import React from 'react';
import { KeysBlock } from '../../KeysBlock';
import { LocationType } from '../StorageLocations.types';
import { StorageLocationDetails } from './StorageLocationDetails';
jest.mock('../../KeysBlock', () => ({
    KeysBlock: jest.fn(({ children }) => React.createElement("div", { "data-testid": "keys-block" }, children)),
}));
describe('StorageLocationDetails', () => {
    const location = {
        locationID: 'Location1',
        path: 'path',
        name: 'name',
        description: 'description',
        type: LocationType.CLIENT,
    };
    it('should have only a DescriptionBlock when not an S3 location', () => {
        render(React.createElement(StorageLocationDetails, { location: location }));
        expect(screen.getByTestId('storage-location-wrapper').children).toHaveLength(1);
        expect(screen.getByTestId('storage-location-description').querySelector('pre')).toHaveTextContent(location.description);
    });
    it('should have also a KeysBlock when an S3 location', () => {
        const s3Location = Object.assign(Object.assign({}, location), { accessKey: 'access', secretKey: 'secret', bucketName: 'bucket' });
        render(React.createElement(StorageLocationDetails, { location: s3Location }));
        expect(screen.getByTestId('keys-block')).toBeInTheDocument();
        expect(KeysBlock).toHaveBeenCalledWith(expect.objectContaining({ accessKey: s3Location.accessKey, secretKey: s3Location.secretKey }), expect.anything());
    });
});
//# sourceMappingURL=StorageLocationDetails.test.js.map