import React from 'react';
import { shallow } from 'enzyme';
import { BackupCreation } from './BackupCreation';
import { dataQa } from '@percona/platform-core';

describe('BackupCreation', () => {
  it('should render', () => {
    const wrapper = shallow(<BackupCreation date={Date.now()} />);
    expect(wrapper.find(dataQa('backup-creation')).exists()).toBeTruthy();
    expect(wrapper.find(dataQa('backup-creation')).children()).toHaveLength(2);
  });
});
