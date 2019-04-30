import React from 'react';
import { shallow } from 'enzyme';
import { Graph } from './Graph';
import { mockData } from './__mocks__/mockData';
import { DefaultTimeZone } from '@grafana/ui';

const setup = (propOverrides?: object) => {
  const props = {
    size: { width: 10, height: 20 },
    data: mockData().slice(0, 19),
    range: { from: 0, to: 1 },
    timeZone: DefaultTimeZone,
    ...propOverrides,
  };

  // Enzyme.shallow did not work well with jquery.flop. Mocking the draw function.
  Graph.prototype.draw = jest.fn();

  const wrapper = shallow(<Graph {...props} />);
  const instance = wrapper.instance() as Graph;

  return {
    wrapper,
    instance,
  };
};

describe('Render', () => {
  it('should render component', () => {
    const { wrapper } = setup();

    expect(wrapper).toMatchSnapshot();
  });

  it('should render component with disclaimer', () => {
    const { wrapper } = setup({
      data: mockData(),
    });

    expect(wrapper).toMatchSnapshot();
  });

  it('should show query return no time series', () => {
    const { wrapper } = setup({
      data: [],
    });

    expect(wrapper).toMatchSnapshot();
  });
});
