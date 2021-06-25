import React from 'react';
import { mount } from 'enzyme';
import { LocationType, StorageLocation } from '../StorageLocations.types';
import { WarningBlock } from '../../../../shared/components/Elements/WarningBlock/WarningBlock';
import { RemoveStorageLocationModal } from './RemoveStorageLocationModal';
import { CheckboxField } from '@percona/platform-core';

xdescribe('RemoveStorageLocationModal', () => {
  it('should have a WarningBlock and CheckboxField', () => {
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
    expect(wrapper.find(CheckboxField).exists()).toBeTruthy();
  });
});
