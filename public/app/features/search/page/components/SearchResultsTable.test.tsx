import { render, screen } from '@testing-library/react';
import { Subject } from 'rxjs';

import {
  applyFieldOverrides,
  createTheme,
  DataFrame,
  DataFrameView,
  FieldType,
  PanelPluginMeta,
  toDataFrame,
} from '@grafana/data';
import { usePanelPluginMetasMap } from '@grafana/runtime/internal';

import { getGrafanaSearcher } from '../../service/searcher';
import { DashboardQueryResult, QueryResponse } from '../../service/types';
import { DashboardSearchItemType } from '../../types';

import { SearchResultsTable } from './SearchResultsTable';

jest.mock('@grafana/runtime/internal', () => ({
  ...jest.requireActual('@grafana/runtime/internal'),
  usePanelPluginMetasMap: jest.fn(),
}));

const usePanelPluginMetasMapMock = jest.mocked(usePanelPluginMetasMap);

describe('SearchResultsTable', () => {
  beforeEach(() => {
    usePanelPluginMetasMapMock.mockReturnValue({
      loading: false,
      error: undefined,
      value: { graph: { id: 'graph', name: 'Graph (old)' } as PanelPluginMeta },
    });
  });

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
      isItemLoaded: jest.fn().mockReturnValue(true),
      loadMoreItems: jest.fn(),
      totalRows: searchData.length,
      view: new DataFrameView<DashboardQueryResult>(dataFrames[0]),
    };

    beforeAll(() => {
      jest.spyOn(getGrafanaSearcher(), 'search').mockResolvedValue(mockSearchResult);
    });

    it('shows the table with the correct accessible label', async () => {
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
      const table = await screen.findByRole('table', { name: 'Search results table' });
      expect(table).toBeInTheDocument();
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
      await screen.findByRole('table');
      expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'Type' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'Tags' })).toBeInTheDocument();
    });

    it('displays the data correctly in the table', async () => {
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
      await screen.findByRole('table');

      const rows = screen.getAllByRole('row');

      expect(rows).toHaveLength(2);
      expect(screen.getByText('My dashboard 1')).toBeInTheDocument();
      expect(screen.getByText('foo')).toBeInTheDocument();
      expect(screen.getByText('bar')).toBeInTheDocument();
    });
  });

  describe('when there is panel data', () => {
    const panelSearchData = toDataFrame({
      name: 'B',
      fields: [
        { name: 'kind', type: FieldType.string, config: {}, values: ['panel'] },
        { name: 'uid', type: FieldType.string, config: {}, values: [null] },
        { name: 'name', type: FieldType.string, config: {}, values: ['My panel'] },
        { name: 'panel_type', type: FieldType.string, config: {}, values: ['graph'] },
        { name: 'url', type: FieldType.string, config: {}, values: ['/d/abc/panel-1'] },
        { name: 'tags', type: FieldType.other, config: {}, values: [[]] },
        { name: 'ds_uid', type: FieldType.other, config: {}, values: [''] },
        { name: 'location', type: FieldType.string, config: {}, values: [''] },
      ],
    });
    const panelDataFrames = applyFieldOverrides({
      data: [panelSearchData],
      fieldConfig: { defaults: {}, overrides: [] },
      replaceVariables: (value) => value,
      theme: createTheme(),
    });
    const mockPanelSearchResult: QueryResponse = {
      isItemLoaded: jest.fn().mockReturnValue(true),
      loadMoreItems: jest.fn(),
      totalRows: panelSearchData.length,
      view: new DataFrameView<DashboardQueryResult>(panelDataFrames[0]),
    };

    it('shows resolved panel plugin name in Type column', async () => {
      render(
        <SearchResultsTable
          keyboardEvents={mockKeyboardEvents}
          response={mockPanelSearchResult}
          onTagSelected={mockOnTagSelected}
          clearSelection={mockClearSelection}
          height={1000}
          width={1000}
        />
      );
      await screen.findByRole('table');
      expect(screen.getByTitle('Graph (old)')).toBeInTheDocument();
    });
  });

  describe('when there is no data', () => {
    const emptySearchData: DataFrame = {
      fields: [
        { name: 'kind', type: FieldType.string, config: {}, values: [] },
        { name: 'name', type: FieldType.string, config: {}, values: [] },
        { name: 'uid', type: FieldType.string, config: {}, values: [] },
        { name: 'url', type: FieldType.string, config: {}, values: [] },
        { name: 'tags', type: FieldType.other, config: {}, values: [] },
        { name: 'location', type: FieldType.string, config: {}, values: [] },
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

    it('shows a "No data" message', async () => {
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
      const noData = await screen.findByText('No values');
      expect(noData).toBeInTheDocument();
      expect(screen.queryByRole('table', { name: 'Search results table' })).not.toBeInTheDocument();
    });
  });
});
