import { dataQa } from '@percona/platform-core';
import { shallow } from 'enzyme';
import React from 'react';

import { EmptyBlock } from './EmptyBlock';

describe('EmptyBlock', () => {
  it('render external wrapper with data-qa attribute', () => {
    const wrapper = shallow(<EmptyBlock dataQa="test-data-qa" />);
    expect(wrapper.find(dataQa('test-data-qa')).exists()).toBeTruthy();
  });

  it('should render children', () => {
    const wrapper = shallow(
      <EmptyBlock dataQa="test-data-qa">
        <span data-qa="span-test">TEST</span>
      </EmptyBlock>
    );
    expect(wrapper.find(dataQa('span-test')).exists()).toBeTruthy();
  });
});
