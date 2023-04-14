import { render, screen } from '@testing-library/react';
import React from 'react';
import { Subject } from 'rxjs';

import {
  applyFieldOverrides,
  ArrayVector,
  createTheme,
  DataFrame,
  DataFrameView,
  FieldType,
  toDataFrame,
} from '@grafana/data';

import { DashboardQueryResult, getGrafanaSearcher, QueryResponse } from '../../service';
import { DashboardSearchItemType } from '../../types';

import { SearchResultsTable } from './SearchResultsTable';

describe('SearchResultsTable', () => {
  const mockOnTagSelected = jest.fn();
  const mockClearSelection = jest.fn();
  const mockSelectionToggle = jest.fn();
  const mockSelection = jest.fn();
  const mockKeyboardEvents = new Subject<React.KeyboardEvent>();

  describe('when there is data', () => {
    const searchData = toDataFrame({
      name: 'A',
      fields: [
        { name: 'kind', type: FieldType.string, config: {}, values: [DashboardSearchItemType.DashDB] },
        { name: 'uid', type: FieldType.string, config: {}, values: ['my-dashboard-1'] },
        { name: 'name', type: FieldType.string, config: {}, values: ['My dashboard 1'] },
        { name: 'panel_type', type: FieldType.string, config: {}, values: [''] },
        { name: 'url', type: FieldType.string, config: {}, values: ['/my-dashboard-1'] },
        { name: 'tags', type: FieldType.other, config: {}, values: [['foo', 'bar']] },
        { name: 'ds_uid', type: FieldType.other, config: {}, values: [''] },
        { name: 'location', type: FieldType.string, config: {}, values: ['/my-dashboard-1'] },
      ],
    });
    const dataFrames = applyFieldOverrides({
      data: [searchData],
      fieldConfig: {
        defaults: {},
        overrides: [],
      },
      replaceVariables: (value, vars, format) => {
        return vars && value === '${__value.text}' ? vars['__value']!.value.text : value;
      },
      theme: createTheme(),
    });

    const mockSearchResult: QueryResponse = {
      isItemLoaded: jest.fn(),
      loadMoreItems: jest.fn(),
      totalRows: searchData.length,
      view: new DataFrameView<DashboardQueryResult>(dataFrames[0]),
    };

    beforeAll(() => {
      jest.spyOn(getGrafanaSearcher(), 'search').mockResolvedValue(mockSearchResult);
    });

    it('shows the table with the correct accessible label', () => {
      render(
        <SearchResultsTable
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
      expect(screen.getByRole('table', { name: 'Search results table' })).toBeInTheDocument();
    });

    it('has the correct row headers', async () => {
      render(
        <SearchResultsTable
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
      expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'Type' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'Tags' })).toBeInTheDocument();
    });

    it('displays the data correctly in the table', () => {
      render(
        <SearchResultsTable
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

      expect(rows).toHaveLength(2);
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
        <SearchResultsTable
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
      expect(screen.queryByRole('table', { name: 'Search results table' })).not.toBeInTheDocument();
      expect(screen.getByText('No data')).toBeInTheDocument();
    });
  });
});
