import React from 'react';
import { mount, shallow } from 'enzyme';
import { SearchResultsFilter, Props } from './SearchResultsFilter';

const noop = jest.fn();

const findBtnByText = (wrapper: any, text: string) =>
  wrapper.findWhere((c: any) => c.name() === 'Button' && c.text() === text);

const setup = (propOverrides?: Partial<Props>, renderMethod = shallow) => {
  const props: Props = {
    //@ts-ignore
    allChecked: false,
    canDelete: false,
    canMove: false,
    deleteItem: noop,
    moveTo: noop,
    onStarredFilterChange: noop,
    onTagFilterChange: noop,
    onToggleAllChecked: noop,
    selectedStarredFilter: false,
    selectedTagFilter: ['tag'],
  };

  Object.assign(props, propOverrides);

  const wrapper = renderMethod(<SearchResultsFilter {...props} />);
  const instance = wrapper.instance();

  return {
    wrapper,
    instance,
  };
};

describe('SearchResultsFilter', () => {
  it('should render "filter by starred" and "filter by tag" filters by default', () => {
    const { wrapper } = setup();
    expect(wrapper.find({ placeholder: 'Filter by starred' })).toHaveLength(1);
    expect(wrapper.find({ placeholder: 'Filter by tag' })).toHaveLength(1);
    expect(findBtnByText(wrapper, 'Move')).toHaveLength(0);
    expect(findBtnByText(wrapper, 'Delete')).toHaveLength(0);
  });

  it('should render Move and Delete buttons when canDelete is true', () => {
    const { wrapper } = setup({ canDelete: true });
    expect(wrapper.find({ placeholder: 'Filter by starred' })).toHaveLength(0);
    expect(wrapper.find({ placeholder: 'Filter by tag' })).toHaveLength(0);
    expect(findBtnByText(wrapper, 'Move')).toHaveLength(1);
    expect(findBtnByText(wrapper, 'Delete')).toHaveLength(1);
  });

  it('should render Move and Delete buttons when canMove is true', () => {
    const { wrapper } = setup({ canMove: true });
    expect(wrapper.find({ placeholder: 'Filter by starred' })).toHaveLength(0);
    expect(wrapper.find({ placeholder: 'Filter by tag' })).toHaveLength(0);
    expect(findBtnByText(wrapper, 'Move')).toHaveLength(1);
    expect(findBtnByText(wrapper, 'Delete')).toHaveLength(1);
  });

  it('should be called with proper filter option when "filter by starred" is changed', () => {
    const mockFilterStarred = jest.fn();
    const option = { value: true, label: 'Yes' };
    //@ts-ignore
    const { wrapper } = setup({ onStarredFilterChange: mockFilterStarred }, mount);
    wrapper
      .find({ placeholder: 'Filter by starred' })
      .at(0)
      .prop('onChange')(option);
    expect(mockFilterStarred).toHaveBeenCalledTimes(1);
    expect(mockFilterStarred).toHaveBeenCalledWith(option);
  });

  it('should be called with proper filter option when "filter by tags" is changed', () => {
    const mockFilterByTags = jest.fn();
    const tags = [
      { value: 'tag1', label: 'Tag 1' },
      { value: 'tag2', label: 'Tag 2' },
    ];
    //@ts-ignore
    const { wrapper } = setup({ onTagFilterChange: mockFilterByTags }, mount);
    wrapper
      .find({ placeholder: 'Filter by tag' })
      .at(0)
      .prop('onChange')(tags[0]);
    expect(mockFilterByTags).toHaveBeenCalledTimes(1);
    expect(mockFilterByTags).toHaveBeenCalledWith(tags[0]);
  });
});
