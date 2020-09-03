import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SearchResultsFilter, Props } from './SearchResultsFilter';

jest.mock('app/core/services/search_srv');

const noop = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
});

const setup = (propOverrides?: Partial<Props>) => {
  const props: Props = {
    allChecked: false,
    canDelete: false,
    canMove: false,
    deleteItem: noop,
    moveTo: noop,
    onStarredFilterChange: noop,
    onTagFilterChange: noop,
    onToggleAllChecked: noop,
    query: { starred: false, sort: null, tag: ['tag'] },
    onSortChange: noop,
    editable: true,
  };

  Object.assign(props, propOverrides);

  render(<SearchResultsFilter {...props} />);
};

describe('SearchResultsFilter', () => {
  it('should render "filter by starred" and "filter by tag" filters by default', async () => {
    setup();
    expect(await screen.findAllByRole('checkbox')).toHaveLength(1);
    expect(screen.queryByText('Move')).not.toBeInTheDocument();
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  });

  it('should render Move and Delete buttons when canDelete is true', async () => {
    setup({ canDelete: true });
    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
    expect(screen.queryByText('Move')).toBeInTheDocument();
    expect(screen.queryByText('Delete')).toBeInTheDocument();
  });

  // it('should render Move and Delete buttons when canMove is true', () => {
  //   const { wrapper } = setup({ canMove: true });
  //   expect(wrapper.find('Checkbox')).toHaveLength(1);
  //   expect(findBtnByText(wrapper, 'Move')).toHaveLength(1);
  //   expect(findBtnByText(wrapper, 'Delete')).toHaveLength(1);
  // });
  //
  // it('should be called with proper filter option when "filter by starred" is changed', () => {
  //   const mockFilterStarred = jest.fn();
  //   const option = { value: true, label: 'Yes' };
  //   //@ts-ignore
  //   const { wrapper } = setup({ onStarredFilterChange: mockFilterStarred }, mount);
  //   //@ts-ignore
  //   wrapper
  //     .find('Checkbox')
  //     .at(1)
  //     .prop('onChange')(option as any);
  //
  //   expect(mockFilterStarred).toHaveBeenCalledTimes(1);
  //   expect(mockFilterStarred).toHaveBeenCalledWith(option);
  // });
  //
  // it('should be called with proper filter option when "filter by tags" is changed', () => {
  //   const mockFilterByTags = jest.fn();
  //   const tags = [
  //     { value: 'tag1', label: 'Tag 1' },
  //     { value: 'tag2', label: 'Tag 2' },
  //   ];
  //   //@ts-ignore
  //   const { wrapper } = setup({ onTagFilterChange: mockFilterByTags }, mount);
  //   wrapper
  //     .find({ placeholder: 'Filter by tag' })
  //     .at(0)
  //     .prop('onChange')([tags[0]]);
  //   expect(mockFilterByTags).toHaveBeenCalledTimes(1);
  //   expect(mockFilterByTags).toHaveBeenCalledWith(['tag1']);
  // });
});
