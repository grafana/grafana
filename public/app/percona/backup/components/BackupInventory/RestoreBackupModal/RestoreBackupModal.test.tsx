import React from 'react';
import { mount } from 'enzyme';
import { dataTestId } from '@percona/platform-core';
import { Backup } from '../BackupInventory.types';
import { RestoreBackupModal } from './RestoreBackupModal';
import { BackupStatus, DataModel } from 'app/percona/backup/Backup.types';
import { Databases } from 'app/percona/shared/core';

xdescribe('RestoreBackupModal', () => {
  const backup: Backup = {
    id: 'backup1',
    name: 'Backup 1',
    created: 1621956564096,
    locationId: 'location_1',
    locationName: 'Location One',
    serviceId: 'service_1',
    serviceName: 'Service One',
    dataModel: DataModel.PHYSICAL,
    status: BackupStatus.BACKUP_STATUS_SUCCESS,
    vendor: Databases.mongodb,
  };

  it('should render', () => {
    const wrapper = mount(<RestoreBackupModal isVisible backup={backup} onClose={jest.fn()} onRestore={jest.fn()} />);
    expect(wrapper.find(dataTestId('restore-button')).exists()).toBeTruthy();
    expect(wrapper.find(dataTestId('restore-cancel-button')).exists()).toBeTruthy();
    expect(wrapper.find(dataTestId('backup-modal-error')).text()).toHaveLength(0);
  });

  it('should block restore button and show error when noService is passed and same service is selected', () => {
    const wrapper = mount(
      <RestoreBackupModal isVisible noService backup={backup} onClose={jest.fn()} onRestore={jest.fn()} />
    );

    expect(wrapper.find(dataTestId('backup-modal-error')).text()).not.toHaveLength(0);
    expect(wrapper.find(dataTestId('restore-button')).first().prop('disabled')).toBeTruthy();
  });

  it('should not block restore button or show error when noService is passed and compatible service is selected', () => {
    const wrapper = mount(
      <RestoreBackupModal isVisible noService backup={backup} onClose={jest.fn()} onRestore={jest.fn()} />
    );

    wrapper.find(dataTestId('serviceType-radio-button')).at(1).simulate('change');

    expect(wrapper.find(dataTestId('backup-modal-error')).text()).toHaveLength(0);
    expect(wrapper.find(dataTestId('restore-button')).first().prop('disabled')).toBeFalsy();
  });
});
