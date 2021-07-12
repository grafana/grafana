import React from 'react';
import { render, fireEvent, screen, waitFor, act } from '@testing-library/react';
import selectEvent from 'react-select-event';
import * as SearchSrv from 'app/core/services/search_srv';
import * as MockSearchSrv from 'app/core/services/__mocks__/search_srv';
import { DashboardSearch, Props } from './DashboardSearch';
import { searchResults } from '../testData';
import { SearchLayout } from '../types';
import { locationService } from '@grafana/runtime';

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
  jest.runOnlyPendingTimers();
};

/**
 * Need to wrap component render in async act and use jest.runAllTimers to test
 * calls inside useDebounce hook
 */
describe('DashboardSearch', () => {
  it('should call search api with default query when initialised', async () => {
    locationService.push('/');
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
      prevSort: null,
    });
  });

  it('should call api with updated query on query change', async () => {
    locationService.push('/');
    setup();

    const input = await screen.findByPlaceholderText('Search dashboards by name');
    await act((async () => {
      await fireEvent.input(input, { target: { value: 'Test' } });
      jest.runOnlyPendingTimers();
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
      prevSort: null,
    });
  });

  it("should render 'No results' message when there are no dashboards", async () => {
    locationService.push('/');
    setup();

    const message = await screen.findByText('No dashboards matching your query were found.');
    expect(message).toBeInTheDocument();
  });

  it('should render search results', async () => {
    mockSearch.mockResolvedValueOnce(searchResults);

    locationService.push('/');
    setup();

    const section = await screen.findAllByLabelText('Search section');
    expect(section).toHaveLength(2);
    expect(screen.getAllByLabelText('Search items')).toHaveLength(1);
  });

  it('should call search with selected tags', async () => {
    locationService.push('/');
    setup();

    await waitFor(() => screen.getByLabelText('Tag filter'));

    const tagComponent = screen.getByLabelText('Tag filter');
    await selectEvent.select(tagComponent, 'tag1', { container: document.body });

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
        prevSort: null,
      })
    );
  });

  it('should call search api with provided search params', async () => {
    locationService.partial({ query: 'test query', tag: ['tag1'], sort: 'asc' });
    setup({});

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
