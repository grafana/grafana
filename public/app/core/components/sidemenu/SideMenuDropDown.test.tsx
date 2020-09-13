import React from 'react';
import { shallow } from 'enzyme';
import SideMenuDropDown from './SideMenuDropDown';

const setup = (propOverrides?: object) => {
  const props = Object.assign(
    {
      link: {
        text: 'link',
      },
    },
    propOverrides
  );

  return shallow(<SideMenuDropDown {...props} />);
};

describe('Render', () => {
  it('should render component', () => {
    const wrapper = setup();

    expect(wrapper).toMatchSnapshot();
  });

  it('should render children', () => {
    const wrapper = setup({
      link: {
        text: 'link',
        children: [{ id: 1 }, { id: 2 }, { id: 3 }],
      },
    });

    expect(wrapper).toMatchSnapshot();
  });

  it('should not render hideFromMenu children', () => {
    const wrapper = setup({
      link: {
        text: 'link',
        children: [
          { id: 1, hideFromMenu: false },
          { id: 2, hideFromMenu: true },
          { id: 3, hideFromMenu: false },
        ],
      },
    });

    expect(wrapper).toMatchSnapshot();
  });
});
