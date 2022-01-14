import React from 'react';
import { shallow } from 'enzyme';
import { dataQa } from '@percona/platform-core';
import { BucketBlock } from './BucketBlock';

describe('BucketBlock', () => {
  it('should render', () => {
    const wrapper = shallow(<BucketBlock bucketName="bucket" />);
    expect(wrapper.find(dataQa('storage-location-bucket')).exists()).toBeTruthy();
  });
});
