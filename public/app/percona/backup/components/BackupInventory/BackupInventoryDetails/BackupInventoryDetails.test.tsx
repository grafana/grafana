import React from 'react';
import { shallow } from 'enzyme';
import { BackupInventoryDetails } from './BackupInventoryDetails';
import { DataModel, Status } from '../BackupInventory.types';
import { dataQa } from '@percona/platform-core';

describe('BackupInventoryDetails', () => {
  it('should have all fields', () => {
    const wrapper = shallow(
      <BackupInventoryDetails name="backup" status={Status.PAUSED} dataModel={DataModel.LOGICAL} />
    );
    expect(wrapper.find(dataQa('backup-artifact-details-name')).exists()).toBeTruthy();
    expect(wrapper.find(dataQa('backup-artifact-details-status')).exists()).toBeTruthy();
    expect(wrapper.find(dataQa('backup-artifact-details-data-model')).exists()).toBeTruthy();
  });
});
