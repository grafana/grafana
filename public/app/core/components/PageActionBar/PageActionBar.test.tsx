import React from 'react';
import { shallow } from 'enzyme';
import PageActionBar, { Props } from './PageActionBar';

const setup = (propOverrides?: object) => {
  const props: Props = {
    searchQuery: '',
    setSearchQuery: jest.fn(),
    target: '_blank',
    linkButton: { href: 'some/url', title: 'test' },
  };

  Object.assign(props, propOverrides);

  return shallow(<PageActionBar {...props} />);
};

describe('Render', () => {
  it('should render component', () => {
    const wrapper = setup();

    expect(wrapper).toMatchSnapshot();
  });
});
