import { dataQa } from '@percona/platform-core';
import { shallow } from 'enzyme';
import React from 'react';

import { BackupCreation } from './BackupCreation';

describe('BackupCreation', () => {
  it('should render', () => {
    const wrapper = shallow(<BackupCreation date={Date.now()} />);
    expect(wrapper.find(dataQa('backup-creation')).exists()).toBeTruthy();
    expect(wrapper.find(dataQa('backup-creation')).children()).toHaveLength(2);
  });
});
