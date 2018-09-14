import React from 'react';
import { shallow } from 'enzyme';
import { ActionBar, Props } from './ActionBar';

const setup = (propOverrides?: object) => {
  const props: Props = {
    searchQuery: '',
    hasEditPermissionInFolders: false,
    canSave: false,
    isEditor: false,
    folderId: 0,
    updateSearchQuery: jest.fn(),
  };

  Object.assign(props, propOverrides);

  const wrapper = shallow(<ActionBar {...props} />);
  const instance = wrapper.instance();

  return {
    wrapper,
    instance,
  };
};

describe('Render', () => {
  it('should render component', () => {
    const { wrapper } = setup();

    expect(wrapper).toMatchSnapshot();
  });

  it('should render add dashboard if user has permissions', () => {
    const { wrapper } = setup({
      hasEditPermissionInFolders: true,
    });

    expect(wrapper).toMatchSnapshot();
  });

  it('should render import dashboard if user has permissions', () => {
    const { wrapper } = setup({
      isEditor: true,
    });

    expect(wrapper).toMatchSnapshot();
  });
});
