import React from 'react';
import { render, fireEvent, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as SearchSrv from 'app/core/services/search_srv';
import * as MockSearchSrv from 'app/core/services/__mocks__/search_srv';
import { DashboardSearch, Props } from './DashboardSearch';
import { searchResults } from '../testData';
import { SearchLayout } from '../types';

jest.mock('app/core/services/search_srv');
// Typecast the mock search so the mock import is correctly recognised by TS
// https://stackoverflow.com/a/53222290
const { mockSearch } = SearchSrv as typeof MockSearchSrv;

beforeEach(() => {
  jest.useFakeTimers();
  mockSearch.mockClear();
});

afterEach(() => {
  jest.useRealTimers();
});

const setup = (testProps?: Partial<Props>) => {
  const props: any = {
    onCloseSearch: () => {},
    ...testProps,
  };
  render(<DashboardSearch {...props} />);
  jest.runAllTimers();
};

/**
 * Need to wrap component render in async act and use jest.runAllTimers to test
 * calls inside useDebounce hook
 */
describe('DashboardSearch', () => {
  it('should call search api with default query when initialised', async () => {
    setup();

    await waitFor(() => screen.getByPlaceholderText('Search dashboards by name'));

    expect(mockSearch).toHaveBeenCalledTimes(1);
    expect(mockSearch).toHaveBeenCalledWith({
      query: '',
      tag: [],
      skipRecent: false,
      skipStarred: false,
      starred: false,
      folderIds: [],
      layout: SearchLayout.Folders,
      sort: undefined,
    });
  });

  it('should call api with updated query on query change', async () => {
    setup();

    const input = await screen.findByPlaceholderText('Search dashboards by name');
    await act((async () => {
      await fireEvent.input(input, { target: { value: 'Test' } });
      jest.runAllTimers();
    }) as any);

    expect(mockSearch).toHaveBeenCalledWith({
      query: 'Test',
      skipRecent: false,
      skipStarred: false,
      tag: [],
      starred: false,
      folderIds: [],
      layout: SearchLayout.Folders,
      sort: undefined,
    });
  });

  it("should render 'No results' message when there are no dashboards", async () => {
    setup();

    const message = await screen.findByText('No dashboards matching your query were found.');
    expect(message).toBeInTheDocument();
  });

  it('should render search results', async () => {
    mockSearch.mockResolvedValueOnce(searchResults);

    setup();
    const section = await screen.findAllByLabelText('Search section');
    expect(section).toHaveLength(2);
    expect(screen.getAllByLabelText('Search items')).toHaveLength(1);
  });

  it('should call search with selected tags', async () => {
    setup();

    await waitFor(() => screen.getByLabelText('Tag filter'));
    // Get the actual element for the underlying Select component, since Select doesn't accept aria- props
    const tagComponent = screen.getByLabelText('Tag filter').querySelector('div') as Node;
    fireEvent.keyDown(tagComponent, { keyCode: 40 });

    const firstTag = await screen.findByText('tag1');
    userEvent.click(firstTag);

    expect(tagComponent).toBeInTheDocument();

    await waitFor(() =>
      expect(mockSearch).toHaveBeenCalledWith({
        query: '',
        skipRecent: false,
        skipStarred: false,
        tag: ['tag1'],
        starred: false,
        folderIds: [],
        layout: SearchLayout.Folders,
        sort: undefined,
      })
    );
  });

  it('should call search api with provided search params', async () => {
    const params = { query: 'test query', tag: ['tag1'], sort: { value: 'asc' } };
    setup({ params });

    await waitFor(() => {
      expect(mockSearch).toHaveBeenCalledTimes(1);
      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'test query',
          tag: ['tag1'],
          sort: 'asc',
        })
      );
    });
  });
});
