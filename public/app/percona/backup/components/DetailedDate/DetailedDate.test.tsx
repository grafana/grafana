import React from 'react';
import { shallow } from 'enzyme';
import { DetailedDate } from './DetailedDate';
import { dataTestId } from '@percona/platform-core';

describe('DetailedDate', () => {
  it('should render', () => {
    const wrapper = shallow(<DetailedDate date={Date.now()} />);
    expect(wrapper.find(dataTestId('detailed-date')).exists()).toBeTruthy();
    expect(wrapper.find(dataTestId('detailed-date')).children()).toHaveLength(2);
  });
});
