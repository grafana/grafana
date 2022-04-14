import React from 'react';
import { LocationType, StorageLocation } from '../StorageLocations.types';
import { RemoveStorageLocationModal } from './RemoveStorageLocationModal';
import { render, screen } from '@testing-library/react';

describe('RemoveStorageLocationModal', () => {
  it('should have a WarningBlock and CheckboxField', async () => {
    const location: StorageLocation = {
      locationID: 'ID1',
      name: 'Location_1',
      description: 'description',
      type: LocationType.CLIENT,
      path: '/foo',
    };
    render(
      <RemoveStorageLocationModal
        isVisible
        location={location}
        loading={false}
        setVisible={jest.fn()}
        onDelete={jest.fn()}
      />
    );

    expect(screen.getByTestId('warning-block')).toBeInTheDocument();
    expect(screen.getByTestId('force-checkbox-input')).toBeInTheDocument();
  });
});
