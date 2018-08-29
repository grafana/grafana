import React from 'react';
import { shallow } from 'enzyme';
import SideMenuTop from './SideMenuTop';

const setup = (propOverrides?: object) => {
  const props = {};

  return shallow(<SideMenuTop {...props} />);
};
