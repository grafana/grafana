import { shallow } from 'enzyme';
import React from 'react';

import { DBIcon } from '../../DBIcon';
import { StorageLocation } from '../StorageLocations.types';

import { StorageLocationsActions } from './StorageLocationsActions';

describe('StorageLocationsActions', () => {
  it('should have DBIcon', () => {
    const wrapper = shallow(
      <StorageLocationsActions onDelete={jest.fn()} location={null as unknown as StorageLocation} />
    );
    expect(wrapper.find(DBIcon).exists()).toBeTruthy();
  });
});
