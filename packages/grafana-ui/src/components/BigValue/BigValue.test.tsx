import React from 'react';
import { shallow } from 'enzyme';
import { BigValue, Props, BigValueColorMode, BigValueGraphMode } from './BigValue';
import { getTheme } from '../../themes';

function getProps(propOverrides?: Partial<Props>): Props {
  const props: Props = {
    colorMode: BigValueColorMode.Background,
    graphMode: BigValueGraphMode.Line,
    height: 300,
    width: 300,
    value: {
      text: '25',
      numeric: 25,
    },
    theme: getTheme(),
  };

  Object.assign(props, propOverrides);
  return props;
}

const setup = (propOverrides?: object) => {
  const props = getProps(propOverrides);
  const wrapper = shallow(<BigValue {...props} />);
  const instance = wrapper.instance() as BigValue;

  return {
    instance,
    wrapper,
  };
};

describe('BigValue', () => {
  describe('Render with basic options', () => {
    it('should render', () => {
      const { wrapper } = setup();
      expect(wrapper).toMatchSnapshot();
    });
  });
});
