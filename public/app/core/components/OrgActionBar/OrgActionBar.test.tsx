import React from 'react';
import { shallow } from 'enzyme';
import OrgActionBar, { Props } from './OrgActionBar';

const setup = (propOverrides?: object) => {
  const props: Props = {
    searchQuery: '',
    showLayoutMode: true,
    setSearchQuery: jest.fn(),
    linkButton: { href: 'some/url', title: 'test' },
  };

  Object.assign(props, propOverrides);

  return shallow(<OrgActionBar {...props} />);
};

describe('Render', () => {
  it('should render component', () => {
    const wrapper = setup();

    expect(wrapper).toMatchSnapshot();
  });

  it('should hide layout mode', () => {
    const wrapper = setup({
      showLayoutMode: false,
    });

    expect(wrapper).toMatchSnapshot();
  });
});
