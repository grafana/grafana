import { dataTestId } from '@percona/platform-core';
import { shallow } from 'enzyme';
import React from 'react';

import { DataModel, BackupStatus } from 'app/percona/backup/Backup.types';

import { BackupInventoryDetails } from './BackupInventoryDetails';

describe('BackupInventoryDetails', () => {
  it('should have all fields', () => {
    const wrapper = shallow(
      <BackupInventoryDetails name="backup" status={BackupStatus.BACKUP_STATUS_PAUSED} dataModel={DataModel.LOGICAL} />
    );
    expect(wrapper.find(dataTestId('backup-artifact-details-name')).exists()).toBeTruthy();
    expect(wrapper.find(dataTestId('backup-artifact-details-data-model')).exists()).toBeTruthy();
  });
});
