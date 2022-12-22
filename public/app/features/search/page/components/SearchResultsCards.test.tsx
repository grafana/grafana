import { render, screen } from '@testing-library/react';
import React from 'react';
import { Subject } from 'rxjs';

import { ArrayVector, DataFrame, DataFrameView, FieldType } from '@grafana/data';

import { DashboardQueryResult, getGrafanaSearcher, QueryResponse } from '../../service';
import { DashboardSearchItemType } from '../../types';

import { SearchResultsCards } from './SearchResultsCards';

describe('SearchResultsCards', () => {
  const mockOnTagSelected = jest.fn();
  const mockClearSelection = jest.fn();
  const mockSelectionToggle = jest.fn();
  const mockSelection = jest.fn();
  const mockKeyboardEvents = new Subject<React.KeyboardEvent>();

  describe('when there is data', () => {
    const searchData: DataFrame = {
      fields: [
        { name: 'kind', type: FieldType.string, config: {}, values: new ArrayVector([DashboardSearchItemType.DashDB]) },
        { name: 'uid', type: FieldType.string, config: {}, values: new ArrayVector(['my-dashboard-1']) },
        { name: 'name', type: FieldType.string, config: {}, values: new ArrayVector(['My dashboard 1']) },
        { name: 'panel_type', type: FieldType.string, config: {}, values: new ArrayVector(['']) },
        { name: 'url', type: FieldType.string, config: {}, values: new ArrayVector(['/my-dashboard-1']) },
        { name: 'tags', type: FieldType.other, config: {}, values: new ArrayVector([['foo', 'bar']]) },
        { name: 'ds_uid', type: FieldType.other, config: {}, values: new ArrayVector(['']) },
        { name: 'location', type: FieldType.string, config: {}, values: new ArrayVector(['folder0/my-dashboard-1']) },
      ],
      meta: {
        custom: {
          locationInfo: {
            folder0: { name: 'Folder 0', uid: 'f0' },
          },
        },
      },
      length: 1,
    };

    const mockSearchResult: QueryResponse = {
      isItemLoaded: () => true,
      loadMoreItems: () => Promise.resolve(),
      totalRows: searchData.length,
      view: new DataFrameView<DashboardQueryResult>(searchData),
    };

    beforeAll(() => {
      jest.spyOn(getGrafanaSearcher(), 'search').mockResolvedValue(mockSearchResult);
    });

    it('shows the list with the correct accessible label', () => {
      render(
        <SearchResultsCards
          keyboardEvents={mockKeyboardEvents}
          response={mockSearchResult}
          onTagSelected={mockOnTagSelected}
          selection={mockSelection}
          selectionToggle={mockSelectionToggle}
          clearSelection={mockClearSelection}
          height={1000}
          width={1000}
        />
      );
      expect(screen.getByRole('list', { name: 'Search results list' })).toBeInTheDocument();
    });

    it('displays the data correctly in the table', () => {
      render(
        <SearchResultsCards
          keyboardEvents={mockKeyboardEvents}
          response={mockSearchResult}
          onTagSelected={mockOnTagSelected}
          selection={mockSelection}
          selectionToggle={mockSelectionToggle}
          clearSelection={mockClearSelection}
          height={1000}
          width={1000}
        />
      );

      const rows = screen.getAllByRole('row');
      expect(rows).toHaveLength(searchData.length);
      expect(screen.getByText('My dashboard 1')).toBeInTheDocument();
      expect(screen.getByText('foo')).toBeInTheDocument();
      expect(screen.getByText('bar')).toBeInTheDocument();
    });
  });

  describe('when there is no data', () => {
    const emptySearchData: DataFrame = {
      fields: [
        { name: 'kind', type: FieldType.string, config: {}, values: new ArrayVector([]) },
        { name: 'name', type: FieldType.string, config: {}, values: new ArrayVector([]) },
        { name: 'uid', type: FieldType.string, config: {}, values: new ArrayVector([]) },
        { name: 'url', type: FieldType.string, config: {}, values: new ArrayVector([]) },
        { name: 'tags', type: FieldType.other, config: {}, values: new ArrayVector([]) },
        { name: 'location', type: FieldType.string, config: {}, values: new ArrayVector([]) },
      ],
      length: 0,
    };

    const mockEmptySearchResult: QueryResponse = {
      isItemLoaded: jest.fn(),
      loadMoreItems: jest.fn(),
      totalRows: emptySearchData.length,
      view: new DataFrameView<DashboardQueryResult>(emptySearchData),
    };

    beforeAll(() => {
      jest.spyOn(getGrafanaSearcher(), 'search').mockResolvedValue(mockEmptySearchResult);
    });

    it('shows a "No data" message', () => {
      render(
        <SearchResultsCards
          keyboardEvents={mockKeyboardEvents}
          response={mockEmptySearchResult}
          onTagSelected={mockOnTagSelected}
          selection={mockSelection}
          selectionToggle={mockSelectionToggle}
          clearSelection={mockClearSelection}
          height={1000}
          width={1000}
        />
      );
      expect(screen.queryByRole('list', { name: 'Search results list' })).not.toBeInTheDocument();
      expect(screen.getByText('No data')).toBeInTheDocument();
    });
  });
});
