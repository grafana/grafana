import React from 'react';
import { StorageLocationDetails } from './StorageLocationDetails';
import { LocationType, S3Location, StorageLocation } from '../StorageLocations.types';
import { KeysBlock } from '../../KeysBlock';
import { render, screen } from '@testing-library/react';

jest.mock('../../KeysBlock', () => ({
  KeysBlock: jest.fn(({ children }) => <div data-testid="keys-block">{children}</div>),
}));

describe('StorageLocationDetails', () => {
  const location: StorageLocation = {
    locationID: 'Location1',
    path: 'path',
    name: 'name',
    description: 'description',
    type: LocationType.CLIENT,
  };

  it('should have only a DescriptionBlock when not an S3 location', () => {
    render(<StorageLocationDetails location={location} />);

    expect(screen.getByTestId('storage-location-wrapper').children).toHaveLength(1);
    expect(screen.getByTestId('storage-location-description').querySelector('pre')).toHaveTextContent(
      location.description
    );
  });

  it('should have also a KeysBlock when an S3 location', () => {
    const s3Location: S3Location = {
      ...location,
      accessKey: 'access',
      secretKey: 'secret',
      bucketName: 'bucket',
    };
    render(<StorageLocationDetails location={s3Location} />);
    expect(screen.getByTestId('keys-block')).toBeInTheDocument();

    expect(KeysBlock).toHaveBeenCalledWith(
      expect.objectContaining({ accessKey: s3Location.accessKey, secretKey: s3Location.secretKey }),
      expect.anything()
    );
  });
});
