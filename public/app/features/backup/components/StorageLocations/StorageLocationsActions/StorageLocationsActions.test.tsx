import React from 'react';
import { shallow } from 'enzyme';
import { DBIcon } from '../../DBIcon';
import { StorageLocationsActions } from './StorageLocationsActions';
import { LocationType, StorageLocation } from '../StorageLocations.types';

describe('StorageLocationsActions', () => {
  it('should have DBIcon', () => {
    const wrapper = shallow(
      <StorageLocationsActions
        onUpdate={jest.fn()}
        onDelete={jest.fn()}
        location={(null as unknown) as StorageLocation}
      />
    );
    expect(wrapper.find(DBIcon).exists()).toBeTruthy();
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
    const wrapper = shallow(
      <StorageLocationsActions onDelete={jest.fn()} onUpdate={handleUpdate} location={location} />
    );
    wrapper.find(DBIcon).first().simulate('click');

    expect(handleUpdate).toHaveBeenCalledWith(location);
  });
});
