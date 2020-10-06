import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { Props, SearchResultsFilter } from './SearchResultsFilter';
import { SearchLayout } from '../types';

jest.mock('app/core/services/search_srv');

const noop = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
});

const searchQuery = {
  starred: false,
  sort: null,
  tag: ['tag'],
  query: '',
  skipRecent: true,
  skipStarred: true,
  folderIds: [],
  layout: SearchLayout.Folders,
};

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
    onLayoutChange: noop,
    query: searchQuery,
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

  it('should render Move and Delete buttons when canDelete is true', () => {
    setup({ canDelete: true });
    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
    expect(screen.queryByText('Move')).toBeInTheDocument();
    expect(screen.queryByText('Delete')).toBeInTheDocument();
  });

  it('should render Move and Delete buttons when canMove is true', () => {
    setup({ canMove: true });
    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
    expect(screen.queryByText('Move')).toBeInTheDocument();
    expect(screen.queryByText('Delete')).toBeInTheDocument();
  });

  it('should call onStarredFilterChange when "filter by starred" is changed', async () => {
    const mockFilterStarred = jest.fn();
    setup({ onStarredFilterChange: mockFilterStarred });
    const checkbox = await screen.findByLabelText(/filter by starred/i);
    fireEvent.click(checkbox);
    expect(mockFilterStarred).toHaveBeenCalledTimes(1);
  });

  it('should be called with proper filter option when "filter by tags" is changed', async () => {
    const mockFilterByTags = jest.fn();
    setup({
      onTagFilterChange: mockFilterByTags,
      query: { ...searchQuery, tag: [] },
    });
    const tagComponent = await screen.findByLabelText('Tag filter');

    fireEvent.keyDown(tagComponent.querySelector('div') as Node, { keyCode: 40 });
    fireEvent.click(await screen.findByText('tag1'));
    expect(mockFilterByTags).toHaveBeenCalledTimes(1);
    expect(mockFilterByTags).toHaveBeenCalledWith(['tag1']);
  });
});
