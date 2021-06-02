import React from 'react';
import { mount } from 'enzyme';
import { LocationType, StorageLocation } from '../StorageLocations.types';
import { WarningBlock } from '../WarningBlock/WarningBlock';
import { RemoveStorageLocationModal } from './RemoveStorageLocationModal';

describe('RemoveStorageLocationModal', () => {
  it('should have a WarningBlock', () => {
    const location: StorageLocation = {
      locationID: 'ID1',
      name: 'Location_1',
      description: 'description',
      type: LocationType.CLIENT,
      path: '/foo',
    };
    const wrapper = mount(
      <RemoveStorageLocationModal
        isVisible
        location={location}
        loading={false}
        setVisible={jest.fn()}
        onDelete={jest.fn()}
      />
    );
    expect(wrapper.find(WarningBlock).exists()).toBeTruthy();
  });
});
