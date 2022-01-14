import React from 'react';
import { mount } from 'enzyme';
import { Status } from './Status';
import { BackupStatus, RestoreStatus } from '../../Backup.types';
import { Ellipsis } from 'app/percona/shared/components/Elements/Icons';
import { dataTestId } from '@percona/platform-core';

describe('Status', () => {
  describe('pending states', () => {
    it('should show Ellipsis when backup is pending', () => {
      const wrapper = mount(<Status status={BackupStatus.BACKUP_STATUS_PENDING} />);
      expect(wrapper.find(Ellipsis).exists()).toBeTruthy();
      expect(wrapper.find(dataTestId('statusMsg')).exists()).not.toBeTruthy();
    });

    it('should show Ellipsis when backup is in progress', () => {
      const wrapper = mount(<Status status={BackupStatus.BACKUP_STATUS_IN_PROGRESS} />);
      expect(wrapper.find(Ellipsis).exists()).toBeTruthy();
    });

    it('should show Ellipsis when restore is in progress', () => {
      const wrapper = mount(<Status status={RestoreStatus.RESTORE_STATUS_IN_PROGRESS} />);
      expect(wrapper.find(Ellipsis).exists()).toBeTruthy();
    });
  });

  describe('not pending states', () => {
    it('should show message when not pending', () => {
      const wrapper = mount(<Status status={BackupStatus.BACKUP_STATUS_SUCCESS} />);
      expect(wrapper.find(Ellipsis).exists()).not.toBeTruthy();
      expect(wrapper.find(dataTestId('statusMsg')).exists()).toBeTruthy();
    });
  });
});
