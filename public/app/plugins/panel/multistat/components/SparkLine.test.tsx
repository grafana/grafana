import React from 'react';
import { mount } from 'enzyme';
import $ from 'jquery';
import { SparkLine, SparkLineProps } from './SparkLine';

describe('<SparkLine />', () => {
  let props: SparkLineProps;

  beforeEach(() => {
    props = {
      size: { h: 100, w: 400 },
      color: 'rgb(255, 0, 0)',
      flotpairs: [[1000, 10], [2000, 30], [3000, 10], [4000, 10]],
    };
  });

  it('should render sparkline', () => {
    const wrapper = mount(<SparkLine {...props} />);
    const renderedWrapper = wrapper.render();
    expect(renderedWrapper.find('canvas')).toHaveLength(2);
    expect(renderedWrapper.find('canvas.flot-base')).toHaveLength(1);
    expect(renderedWrapper.find('canvas.flot-overlay')).toHaveLength(1);
  });

  it('should set proper padding', () => {
    const wrapper = mount(<SparkLine {...props} />);
    const renderedWrapper = wrapper.render();
    expect(renderedWrapper.find('canvas').get(0).attribs.height).toBe('100');
    expect(renderedWrapper.find('canvas').get(0).attribs.width).toBe('380');
  });

  it('should set proper line and fill colors', () => {
    const plot = ($.plot = jest.fn());
    mount(<SparkLine {...props} />);
    const plotArgs = plot.mock.calls[0];
    const plotSeriesArg = plotArgs[1][0];
    const sparklineOptionsArg = plotArgs[2];
    expect(plotSeriesArg).toMatchObject({ color: 'rgb(255, 0, 0)' });
    expect(sparklineOptionsArg).toMatchObject({ series: { lines: { fillColor: 'rgba(255, 0, 0, 0.1)' } } });
  });
});
