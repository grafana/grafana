import { dataTestId } from '@percona/platform-core';
import { shallow } from 'enzyme';
import React from 'react';

import { DetailedDate } from './DetailedDate';

describe('DetailedDate', () => {
  it('should render', () => {
    const wrapper = shallow(<DetailedDate date={Date.now()} />);
    expect(wrapper.find(dataTestId('detailed-date')).exists()).toBeTruthy();
    expect(wrapper.find(dataTestId('detailed-date')).children()).toHaveLength(2);
  });
});
