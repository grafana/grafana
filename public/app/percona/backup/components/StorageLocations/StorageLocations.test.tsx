import React from 'react';
import { shallow } from 'enzyme';
import { dataTestId, LoaderButton } from '@percona/platform-core';
import { Table } from 'app/percona/integrated-alerting/components/Table/Table';
import { getMount, asyncAct } from 'app/percona/shared/helpers/testUtils';
import { StorageLocationsService } from './StorageLocations.service';
import { stubLocations } from './__mocks__/StorageLocations.service';
import { RemoveStorageLocationModal } from './RemoveStorageLocationModal';
import { StorageLocations } from './StorageLocations';
import { AddStorageLocationModal } from './AddStorageLocationModal';
import { formatLocationList } from './StorageLocations.utils';

jest.mock('./StorageLocations.service');
jest.mock('app/core/app_events');

describe('StorageLocations', () => {
  it('should render table with data', async () => {
    const wrapper = await getMount(<StorageLocations />);
    wrapper.update();

    expect(wrapper.find(Table).prop('data')).toEqual(formatLocationList(stubLocations));
  });

  it('should show delete modal when icon is clicked', async () => {
    const wrapper = await getMount(<StorageLocations />);
    wrapper.update();

    expect(wrapper.find(RemoveStorageLocationModal).prop('isVisible')).toBe(false);
    wrapper.find(dataTestId('delete-storage-location-button')).last().simulate('click');
    expect(wrapper.find(RemoveStorageLocationModal).prop('isVisible')).toBe(true);
  });

  it('should close delete modal after deletion confirmation', async () => {
    const spy = spyOn(StorageLocationsService, 'delete').and.callThrough();
    const wrapper = await getMount(<StorageLocations />);

    wrapper.update();
    wrapper.find('tbody tr').first().find(dataTestId('delete-storage-location-button')).last().simulate('click');

    expect(wrapper.find(RemoveStorageLocationModal).prop('isVisible')).toBe(true);
    await asyncAct(() => wrapper.find(LoaderButton).simulate('submit'));

    wrapper.update();
    expect(wrapper.find(RemoveStorageLocationModal).prop('isVisible')).toBe(false);
    expect(spy).toHaveBeenCalledWith(stubLocations.locations[0].location_id, false);
  });

  it('should open the modal by clicking the "Add" button', () => {
    const wrapper = shallow(<StorageLocations />);

    expect(wrapper.find(AddStorageLocationModal).prop('isVisible')).toBeFalsy();
    wrapper.find(dataTestId('storage-location-add-modal-button')).simulate('click');
    expect(wrapper.find(AddStorageLocationModal).prop('isVisible')).toBeTruthy();
  });
});
