import React from 'react';
import { shallow } from 'enzyme';
import { FormField, Props } from './FormField';

const setup = (propOverrides?: object) => {
  const props: Props = {
    label: 'Test',
    labelWidth: 11,
    value: 10,
    onChange: jest.fn(),
  };

  Object.assign(props, propOverrides);

  return shallow(<FormField {...props} />);
};

describe('Render', () => {
  it('should render component', () => {
    const wrapper = setup();

    expect(wrapper).toMatchSnapshot();
  });
});
