import { dataTestId } from '@percona/platform-core';
import { shallow } from 'enzyme';
import React from 'react';

import { BucketBlock } from './BucketBlock';

describe('BucketBlock', () => {
  it('should render', () => {
    const wrapper = shallow(<BucketBlock bucketName="bucket" />);
    expect(wrapper.find(dataTestId('storage-location-bucket')).exists()).toBeTruthy();
  });
});
