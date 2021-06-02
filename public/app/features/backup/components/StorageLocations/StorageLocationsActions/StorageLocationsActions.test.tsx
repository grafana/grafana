import React from 'react';
import { shallow } from 'enzyme';
import { DBIcon } from '../../DBIcon';
import { StorageLocationsActions } from './StorageLocationsActions';
import { StorageLocation } from '../StorageLocations.types';

describe('StorageLocationsActions', () => {
  it('should have DBIcon', () => {
    const wrapper = shallow(
      <StorageLocationsActions onDelete={jest.fn()} location={(null as unknown) as StorageLocation} />
    );
    expect(wrapper.find(DBIcon).exists()).toBeTruthy();
  });
});
