import React from 'react';
import { mount } from 'enzyme';
import TopSectionItem from './TopSectionItem';

const setup = (propOverrides?: object) => {
  const props = Object.assign(
    {
      link: {
        text: 'Hello',
        url: '/asd',
      },
    },
    propOverrides
  );

  return mount(<TopSectionItem {...props} />);
};

describe('Render', () => {
  it('should render component', () => {
    const wrapper = setup();
    expect(wrapper).toMatchSnapshot();
  });
});
