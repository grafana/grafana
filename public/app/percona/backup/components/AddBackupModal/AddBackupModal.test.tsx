import React from 'react';
import { mount } from 'enzyme';
import { AsyncSelect } from '@grafana/ui';
import { dataQa, TextareaInputField, TextInputField } from '@percona/platform-core';
import { SelectField } from 'app/percona/shared/components/Form/SelectField';
import { MultiSelectField } from 'app/percona/shared/components/Form/MultiSelectField';
import { RetryModeSelector } from './RetryModeSelector';
import { AddBackupModal } from './AddBackupModal';

jest.mock('./AddBackupModal.service');

describe('AddBackupModal', () => {
  it('should render fields', () => {
    const wrapper = mount(<AddBackupModal isVisible backup={null} onClose={jest.fn()} onBackup={jest.fn()} />);

    expect(wrapper.find(AsyncSelect)).toHaveLength(2);
    expect(wrapper.find(TextInputField)).toHaveLength(2);
    expect(wrapper.find(TextareaInputField)).toHaveLength(1);
    expect(wrapper.find(dataQa('advanced-backup-fields')).exists()).toBeFalsy();
    expect(wrapper.find(RetryModeSelector)).toHaveLength(1);
  });

  it('should render advanced fields when in schedule mode', () => {
    const wrapper = mount(
      <AddBackupModal isVisible scheduleMode backup={null} onClose={jest.fn()} onBackup={jest.fn()} />
    );

    expect(wrapper.find(dataQa('advanced-backup-fields')).exists()).toBeTruthy();
    expect(wrapper.find(SelectField)).toHaveLength(1);
    expect(wrapper.find(MultiSelectField)).toHaveLength(5);
    expect(wrapper.find(RetryModeSelector)).toHaveLength(1);
  });
});
