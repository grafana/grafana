import React from 'react';
import { shallow } from 'enzyme';
import OrgActionBar, { Props } from './OrgActionBar';
import { LayoutModes } from '../LayoutSelector/LayoutSelector';

const setup = (propOverrides?: object) => {
  const props: Props = {
    searchQuery: '',
    setSearchQuery: jest.fn(),
    target: '_blank',
    linkButton: { href: 'some/url', title: 'test' },
    layoutMode: LayoutModes.Grid,
    onSetLayoutMode: jest.fn(),
  };

  Object.assign(props, propOverrides);

  return shallow(<OrgActionBar {...props} />);
};

describe('Render', () => {
  it('should render component', () => {
    const wrapper = setup();

    expect(wrapper).toMatchSnapshot();
  });
});
