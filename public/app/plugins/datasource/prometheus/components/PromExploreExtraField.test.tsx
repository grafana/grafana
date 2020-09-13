import React from 'react';
import { shallow } from 'enzyme';
import { PromExploreExtraField, PromExploreExtraFieldProps } from './PromExploreExtraField';

const setup = (propOverrides?: PromExploreExtraFieldProps) => {
  const label = 'Prometheus Explore Extra Field';
  const value = '123';
  const onChangeFunc = jest.fn();
  const onKeyDownFunc = jest.fn();

  const props: any = {
    label,
    value,
    onChangeFunc,
    onKeyDownFunc,
  };

  Object.assign(props, propOverrides);

  return shallow(<PromExploreExtraField {...props} />);
};

describe('PrometheusExploreExtraField', () => {
  it('should render component', () => {
    const wrapper = setup();
    expect(wrapper).toMatchSnapshot();
  });
});
