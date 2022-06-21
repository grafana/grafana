import { dataTestId } from '@percona/platform-core';
import { shallow } from 'enzyme';
import React from 'react';

import { EmptyBlock } from './EmptyBlock';

describe('EmptyBlock', () => {
  it('render external wrapper with data-testid attribute', () => {
    const wrapper = shallow(<EmptyBlock dataTestId="test-data-testid" />);
    expect(wrapper.find(dataTestId('test-data-testid')).exists()).toBeTruthy();
  });

  it('should render children', () => {
    const wrapper = shallow(
      <EmptyBlock dataTestId="test-data-testid">
        <span data-testid="span-test">TEST</span>
      </EmptyBlock>
    );
    expect(wrapper.find(dataTestId('span-test')).exists()).toBeTruthy();
  });
});
