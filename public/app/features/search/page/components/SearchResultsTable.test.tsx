import { render, screen, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Subject } from 'rxjs';

import { ArrayVector, DataFrame, DataFrameView, FieldType } from '@grafana/data';

import { DashboardQueryResult, getGrafanaSearcher, QueryResponse } from '../../service';
import { DashboardSearchItemType } from '../../types';

import { SearchResultsTable } from './SearchResultsTable';

describe('SearchResultsTable', () => {
  let grafanaSearcherSpy: jest.SpyInstance;
  const mockOnTagSelected = jest.fn();
  const mockClearSelection = jest.fn();
  const mockSelectionToggle = jest.fn();
  const mockSelection = jest.fn();
  const mockKeyboardEvents = new Subject<React.KeyboardEvent>();

  const searchData: DataFrame = {
    fields: [
      { name: 'kind', type: FieldType.string, config: {}, values: new ArrayVector([DashboardSearchItemType.DashDB]) },
      { name: 'name', type: FieldType.string, config: {}, values: new ArrayVector(['My dashboard 1']) },
      { name: 'uid', type: FieldType.string, config: {}, values: new ArrayVector(['my-dashboard-1']) },
      { name: 'url', type: FieldType.string, config: {}, values: new ArrayVector(['/my-dashboard-1']) },
      { name: 'tags', type: FieldType.other, config: {}, values: new ArrayVector([['foo', 'bar']]) },
      { name: 'location', type: FieldType.string, config: {}, values: new ArrayVector(['/my-dashboard-1']) },
    ],
    length: 1,
  };

  const mockSearchResult: QueryResponse = {
    isItemLoaded: jest.fn(),
    loadMoreItems: jest.fn(),
    totalRows: searchData.length,
    view: new DataFrameView<DashboardQueryResult>(searchData),
  };

  beforeAll(() => {
    grafanaSearcherSpy = jest.spyOn(getGrafanaSearcher(), 'search').mockResolvedValue(mockSearchResult);
  });

  // need to make sure we clear localStorage
  // otherwise tests can interfere with each other and the starting expanded state of the component
  // afterEach(() => {
  //   window.localStorage.clear();
  // });

  it('has the correct row headers', async () => {
    render(
      <SearchResultsTable
        keyboardEvents={mockKeyboardEvents}
        response={mockSearchResult}
        onTagSelected={mockOnTagSelected}
        clearSelection={mockClearSelection}
        height={1000}
        width={1000}
      />
    );
    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Type' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Tags' })).toBeInTheDocument();
  });
});
