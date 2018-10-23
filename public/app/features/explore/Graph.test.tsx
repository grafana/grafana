import React from 'react';
import { shallow } from 'enzyme';
import { Graph } from './Graph';
import { mockData } from './__mocks__/mockData';

const setup = (propOverrides?: object) => {
  const props = Object.assign(
    {
      data: mockData().slice(0, 19),
      options: {
        interval: '20s',
        range: { from: 'now-6h', to: 'now' },
        targets: [
          {
            format: 'time_series',
            instant: false,
            hinting: true,
            expr: 'prometheus_http_request_duration_seconds_bucket',
          },
        ],
      },
    },
    propOverrides
  );

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
