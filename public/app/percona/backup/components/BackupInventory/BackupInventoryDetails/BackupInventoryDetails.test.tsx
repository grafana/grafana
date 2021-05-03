import React from 'react';
import { shallow } from 'enzyme';
import { BackupInventoryDetails } from './BackupInventoryDetails';
import { dataQa } from '@percona/platform-core';
import { DataModel, BackupStatus } from 'app/percona/backup/Backup.types';

describe('BackupInventoryDetails', () => {
  it('should have all fields', () => {
    const wrapper = shallow(
      <BackupInventoryDetails name="backup" status={BackupStatus.BACKUP_STATUS_PAUSED} dataModel={DataModel.LOGICAL} />
    );
    expect(wrapper.find(dataQa('backup-artifact-details-name')).exists()).toBeTruthy();
    expect(wrapper.find(dataQa('backup-artifact-details-data-model')).exists()).toBeTruthy();
  });
});
