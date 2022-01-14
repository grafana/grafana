import { shallow } from 'enzyme';
import React from 'react';
import { withSelectStyles } from './withSelectStyles';

const FooWrapper = () => <></>;

describe('withSelectStyles', () => {
  it('should return component with injected className', () => {
    const Foo = withSelectStyles(FooWrapper);
    const wrapper = shallow(<Foo />);

    expect(wrapper.find(FooWrapper).prop('className')).toBeDefined();
  });
});
