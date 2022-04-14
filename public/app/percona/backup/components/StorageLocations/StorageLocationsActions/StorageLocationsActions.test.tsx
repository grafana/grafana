import React from 'react';
import { StorageLocationsActions } from './StorageLocationsActions';
import { LocationType, StorageLocation } from '../StorageLocations.types';
import { render, screen, fireEvent } from '@testing-library/react';

describe('StorageLocationsActions', () => {
  it('should have DBIcon', () => {
    render(
      <StorageLocationsActions
        onUpdate={jest.fn()}
        onDelete={jest.fn()}
        location={(null as unknown) as StorageLocation}
      />
    );
    expect(screen.getByTestId('edit-storage-location-button')).toBeInTheDocument();
    expect(screen.getByTestId('delete-storage-location-button')).toBeInTheDocument();
  });

  it('should call onUpdate', () => {
    const location: StorageLocation = {
      locationID: 'Location1',
      name: 'location_1',
      description: 'first location',
      type: LocationType.S3,
      path: 's3://foo',
    };
    const handleUpdate = jest.fn();
    render(<StorageLocationsActions onDelete={jest.fn()} onUpdate={handleUpdate} location={location} />);
    const edit = screen.getByTestId('edit-storage-location-button');
    fireEvent.click(edit);
    expect(handleUpdate).toHaveBeenCalledWith(location);
  });
});
