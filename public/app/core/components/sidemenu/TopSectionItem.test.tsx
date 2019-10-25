import React from 'react';
import { shallow } from 'enzyme';
import TopSectionItem from './TopSectionItem';

const setup = (propOverrides?: object) => {
  const props = Object.assign(
    {
      link: {},
    },
    propOverrides
  );

  return shallow(<TopSectionItem {...props} />);
};

describe('Render', () => {
  it('should render component', () => {
    const wrapper = setup();

    expect(wrapper).toMatchSnapshot();
  });
});
