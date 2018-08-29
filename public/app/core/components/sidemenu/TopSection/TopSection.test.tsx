import React from 'react';
import { shallow } from 'enzyme';
import TopSection from './TopSection';

const setup = (propOverrides?: object) => {
  const props = Object.assign(
    {
      mainLinks: [],
    },
    propOverrides
  );

  return shallow(<TopSection {...props} />);
};

describe('Render', () => {
  it('should render component', () => {
    const wrapper = setup();

    expect(wrapper).toMatchSnapshot();
  });

  it('should render items', () => {
    const wrapper = setup({
      mainLinks: [
        {
          id: 1,
        },
        {
          id: 2,
        },
        {
          id: 3,
        },
        {
          id: 4,
        },
        {
          id: 5,
        },
      ],
    });

    expect(wrapper).toMatchSnapshot();
  });
});
