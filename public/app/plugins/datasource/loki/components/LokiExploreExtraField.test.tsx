import React from 'react';
import { shallow } from 'enzyme';
import { LokiExploreExtraField, LokiExploreExtraFieldProps } from './LokiExploreExtraField';

const setup = (propOverrides?: LokiExploreExtraFieldProps) => {
  const label = 'Loki Explore Extra Field';
  const value = '123';
  const type = 'number';
  const min = 0;
  const onChangeFunc = jest.fn();
  const onKeyDownFunc = jest.fn();

  const props: any = {
    label,
    value,
    type,
    min,
    onChangeFunc,
    onKeyDownFunc,
  };

  Object.assign(props, propOverrides);

  return shallow(<LokiExploreExtraField {...props} />);
};

describe('LokiExploreExtraField', () => {
  it('should render component', () => {
    const wrapper = setup();
    expect(wrapper).toMatchSnapshot();
  });
});
