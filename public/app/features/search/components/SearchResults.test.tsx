import React from 'react';
import { shallow, mount } from 'enzyme';
import { SearchResults, Props } from './SearchResults';
import { searchResults } from '../testData';

const setup = (propOverrides?: Partial<Props>, renderMethod = shallow) => {
  const props: Props = {
    //@ts-ignore
    results: searchResults,
    onSelectionChanged: () => {},
    onTagSelected: (name: string) => {},
    onFolderExpanding: () => {},
    onToggleSelection: () => {},
    editable: false,
  };

  Object.assign(props, propOverrides);

  const wrapper = renderMethod(<SearchResults {...props} />);
  const instance = wrapper.instance();

  return {
    wrapper,
    instance,
  };
};

describe('SearchResults', () => {
  it('should render result items', () => {
    const { wrapper } = setup();
    expect(wrapper.find({ 'aria-label': 'Search section' })).toHaveLength(2);
  });

  it('should render section items for expanded section', () => {
    const { wrapper } = setup();
    expect(wrapper.find({ 'aria-label': 'Search items' }).children()).toHaveLength(1);
  });

  it('should not render checkboxes for non-editable results', () => {
    //@ts-ignore
    const { wrapper } = setup({ editable: false }, mount);
    expect(wrapper.find({ type: 'checkbox' })).toHaveLength(0);
  });

  it('should render checkboxes for non-editable results', () => {
    //@ts-ignore
    const { wrapper } = setup({ editable: true }, mount);
    expect(wrapper.find({ type: 'checkbox' })).toHaveLength(4);
  });
});
