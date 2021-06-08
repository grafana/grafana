import React from 'react';
import { AsyncSelect } from '@grafana/ui';
import { TextareaInputField, TextInputField } from '@percona/platform-core';
import { mount } from 'enzyme';
import { AddBackupModal } from './AddBackupModal';

jest.mock('./AddBackupModal.service');

xdescribe('AddBackupModal', () => {
  it('should render fields', () => {
    const wrapper = mount(<AddBackupModal isVisible backup={null} onClose={jest.fn()} onBackup={jest.fn()} />);

    expect(wrapper.find(AsyncSelect)).toHaveLength(2);
    expect(wrapper.find(TextInputField)).toHaveLength(2);
    expect(wrapper.find(TextareaInputField)).toHaveLength(1);
  });
});
