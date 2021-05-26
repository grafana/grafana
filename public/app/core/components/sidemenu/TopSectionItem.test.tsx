import React from 'react';
import { mount } from 'enzyme';
import TopSectionItem from './TopSectionItem';
import { MemoryRouter } from 'react-router-dom';

const setup = (propOverrides?: object) => {
  const props = Object.assign(
    {
      link: {
        text: 'Hello',
        icon: 'cloud',
        url: '/asd',
      },
    },
    propOverrides
  );

  return mount(
    <MemoryRouter initialEntries={[{ pathname: '/', key: 'testKey' }]}>
      <TopSectionItem {...props} />
    </MemoryRouter>
  );
};

describe('Render', () => {
  it('should render component', () => {
    const wrapper = setup();
    expect(wrapper).toMatchSnapshot();
  });
});
