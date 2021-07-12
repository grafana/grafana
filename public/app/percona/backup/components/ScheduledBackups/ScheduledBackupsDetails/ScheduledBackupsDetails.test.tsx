import React from 'react';
import { mount } from 'enzyme';
import { ScheduledBackupDetails } from './ScheduledBackupsDetails';
import { DataModel } from 'app/percona/backup/Backup.types';
import { dataQa } from '@percona/platform-core';

describe('ScheduledBackupsDetails', () => {
  it('should render', () => {
    const wrapper = mount(
      <ScheduledBackupDetails
        name="Backup"
        description="description"
        dataModel={DataModel.PHYSICAL}
        cronExpression=" * * * 1,3 0"
      />
    );
    expect(wrapper.find(dataQa('scheduled-backup-details-wrapper')).exists()).toBeTruthy();
    expect(wrapper.find(dataQa('scheduled-backup-details-name')).exists()).toBeTruthy();
    expect(wrapper.find(dataQa('scheduled-backup-details-description')).exists()).toBeTruthy();
    expect(wrapper.find(dataQa('scheduled-backup-details-cron')).exists()).toBeTruthy();
    expect(wrapper.find(dataQa('scheduled-backup-details-data-model')).exists()).toBeTruthy();
    expect(wrapper.find(dataQa('scheduled-backup-details-data-model')).exists()).toBeTruthy();
  });
});
