import React from 'react';
import { shallow } from 'enzyme';
import { FormField, Props } from './FormField';

const setup = (propOverrides?: Partial<Props>) => {
  const props: Props = {
    label: 'Test',
    labelWidth: 11,
    value: 10,
    onChange: jest.fn(),
  };

  Object.assign(props, propOverrides);

  return shallow(<FormField {...props} />);
};

describe('FormField', () => {
  it('should render component with default inputEl', () => {
    const wrapper = setup();

    expect(wrapper).toMatchSnapshot();
  });

  it('should render component with custom inputEl', () => {
    const wrapper = setup({
      inputEl: (
        <>
          <span>Input</span>
          <button>Ok</button>
        </>
      ),
    });

    expect(wrapper).toMatchSnapshot();
  });
});
