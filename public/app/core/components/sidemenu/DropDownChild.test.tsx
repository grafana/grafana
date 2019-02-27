import React from 'react';
import { shallow } from 'enzyme';
import DropDownChild from './DropDownChild';

const setup = (propOverrides?: object) => {
  const props = Object.assign(
    {
      child: {
        divider: true,
      },
    },
    propOverrides
  );

  return shallow(<DropDownChild {...props} />);
};

describe('Render', () => {
  it('should render component', () => {
    const wrapper = setup();

    expect(wrapper).toMatchSnapshot();
  });

  it('should render icon if exists', () => {
    const wrapper = setup({
      child: {
        divider: false,
        icon: 'icon-test',
      },
    });

    expect(wrapper).toMatchSnapshot();
  });
});
