import React from 'react';
import { shallow } from 'enzyme';
import { ActiveFilters, Props } from './ActiveFilters';

const defaultQuery = {
  tag: [],
  starred: false,
  mode: 'tree',
  skipStarred: false,
  skipRecent: false,
  folderIds: [],
  query: '',
};

const setup = (propOverrides?: object) => {
  const props: Props = {
    query: defaultQuery,
    toggleFilterOnStarred: jest.fn(),
    removeTagFilter: jest.fn(),
    clearFilters: jest.fn(),
  };

  Object.assign(props, propOverrides);

  const wrapper = shallow(<ActiveFilters {...props} />);
  const instance = wrapper.instance() as ActiveFilters;

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

  it('should render tags', () => {
    const { wrapper } = setup({ query: { ...defaultQuery, tag: ['blue', 'green', 'red'] } });

    expect(wrapper).toMatchSnapshot();
  });

  it('should render starred', () => {
    const { wrapper } = setup({ query: { ...defaultQuery, starred: true } });

    expect(wrapper).toMatchSnapshot();
  });
});
