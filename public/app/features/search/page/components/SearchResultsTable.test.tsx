import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type MouseEvent } from 'react';
import { Subject } from 'rxjs';

import {
  applyFieldOverrides,
  createTheme,
  type DataFrame,
  DataFrameView,
  FieldType,
  type PanelPluginMeta,
  toDataFrame,
} from '@grafana/data';
import { reportInteraction, useDataSourceInstanceSettings } from '@grafana/runtime';
import { usePanelPluginMetasMap } from '@grafana/runtime/internal';

import { type DashboardQueryResult, type QueryResponse } from '../../service/types';
import { DashboardSearchItemType } from '../../types';

import { SearchResultsTable } from './SearchResultsTable';

jest.mock('@grafana/runtime/internal', () => ({
  ...jest.requireActual('@grafana/runtime/internal'),
  usePanelPluginMetasMap: jest.fn(),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
  useDataSourceInstanceSettings: jest.fn(),
}));

const usePanelPluginMetasMapMock = jest.mocked(usePanelPluginMetasMap);
const useDataSourceInstanceSettingsMock = jest.mocked(useDataSourceInstanceSettings);

describe('SearchResultsTable', () => {
  beforeEach(() => {
    jest.mocked(reportInteraction).mockClear();
    usePanelPluginMetasMapMock.mockReturnValue({
      loading: false,
      error: undefined,
      value: { graph: { id: 'graph', name: 'Graph (old)' } as PanelPluginMeta },
    });
    useDataSourceInstanceSettingsMock.mockReturnValue({ isLoading: false, error: undefined, settings: undefined });
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

    it('does not render a description tooltip indicator when there is no description', async () => {
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

      expect(screen.queryByLabelText('Description')).not.toBeInTheDocument();
    });
  });

  describe('when results include locations', () => {
    function setup() {
      const frame = toDataFrame({
        fields: [
          { name: 'kind', values: ['dashboard', 'dashboard'] },
          { name: 'uid', values: ['team-dashboard', 'root-dashboard'] },
          { name: 'name', values: ['Team dashboard', 'Root dashboard'] },
          { name: 'url', values: ['/d/team-dashboard', '/d/root-dashboard'] },
          { name: 'location', values: ['team-folder', 'general'] },
          { name: 'tags', type: FieldType.other, values: [[], []] },
        ],
        meta: {
          custom: {
            locationInfo: {
              'team-folder': { kind: 'folder', name: 'Team dashboards', url: '/dashboards/f/team-folder' },
            },
          },
        },
      });
      const [dataFrame] = applyFieldOverrides({
        data: [frame],
        fieldConfig: { defaults: {}, overrides: [] },
        replaceVariables: (value) => value,
        theme: createTheme(),
      });
      const response: QueryResponse = {
        view: new DataFrameView<DashboardQueryResult>(dataFrame),
        totalRows: frame.length,
        isItemLoaded: jest.fn().mockReturnValue(true),
        loadMoreItems: jest.fn(),
      };
      const onClickItem = jest.fn((event: MouseEvent<HTMLElement>) => event.preventDefault());
      const user = userEvent.setup();

      render(
        <SearchResultsTable
          response={response}
          clearSelection={mockClearSelection}
          onTagSelected={mockOnTagSelected}
          onClickItem={onClickItem}
          keyboardEvents={mockKeyboardEvents}
          trackingSource="search-test"
          height={1000}
          width={1000}
        />
      );

      return { user, onClickItem };
    }

    it('links to the parent folder and falls back to Dashboards for the root location', () => {
      setup();

      expect(screen.getByRole('link', { name: 'Team dashboards' })).toHaveAttribute(
        'href',
        '/dashboards/f/team-folder'
      );
      expect(screen.getByRole('link', { name: 'Dashboards' })).toHaveAttribute('href', '/dashboards');
    });

    it.each([
      { name: 'Team dashboard', href: '/d/team-dashboard', parent: 'folder' },
      { name: 'Root dashboard', href: '/d/root-dashboard', parent: 'general' },
    ])('reports the $parent parent when opening $name', async ({ name, href, parent }) => {
      const { user, onClickItem } = setup();
      const link = screen.getByRole('link', { name });
      expect(link).toHaveAttribute('href', href);

      await user.click(link);

      expect(onClickItem).toHaveBeenCalledTimes(1);
      expect(reportInteraction).toHaveBeenCalledWith('grafana_browse_dashboards_page_click_list_item', {
        itemKind: 'dashboard',
        parent,
        source: 'search-test',
      });
    });
  });

  describe('when an item has a description', () => {
    const searchData = toDataFrame({
      name: 'A',
      fields: [
        { name: 'kind', type: FieldType.string, config: {}, values: [DashboardSearchItemType.DashDB] },
        { name: 'uid', type: FieldType.string, config: {}, values: ['my-dashboard-1'] },
        { name: 'name', type: FieldType.string, config: {}, values: ['My dashboard 1'] },
        { name: 'description', type: FieldType.string, config: {}, values: ['A helpful description'] },
        { name: 'panel_type', type: FieldType.string, config: {}, values: [''] },
        { name: 'url', type: FieldType.string, config: {}, values: ['/my-dashboard-1'] },
        { name: 'tags', type: FieldType.other, config: {}, values: [['foo', 'bar']] },
        { name: 'ds_uid', type: FieldType.other, config: {}, values: [''] },
        { name: 'location', type: FieldType.string, config: {}, values: ['/my-dashboard-1'] },
      ],
    });
    const dataFrames = applyFieldOverrides({
      data: [searchData],
      fieldConfig: { defaults: {}, overrides: [] },
      replaceVariables: (value) => value,
      theme: createTheme(),
    });
    const mockSearchResult: QueryResponse = {
      isItemLoaded: jest.fn().mockReturnValue(true),
      loadMoreItems: jest.fn(),
      totalRows: searchData.length,
      view: new DataFrameView<DashboardQueryResult>(dataFrames[0]),
    };

    it('renders a description tooltip indicator', async () => {
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

      expect(screen.getByLabelText('Description')).toBeInTheDocument();
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

  describe('when there are datasources', () => {
    const searchData = toDataFrame({
      name: 'C',
      fields: [
        { name: 'kind', type: FieldType.string, config: {}, values: [DashboardSearchItemType.DashDB] },
        { name: 'uid', type: FieldType.string, config: {}, values: ['my-dashboard-1'] },
        { name: 'name', type: FieldType.string, config: {}, values: ['My dashboard 1'] },
        { name: 'panel_type', type: FieldType.string, config: {}, values: [''] },
        { name: 'url', type: FieldType.string, config: {}, values: ['/my-dashboard-1'] },
        { name: 'tags', type: FieldType.other, config: {}, values: [[]] },
        { name: 'ds_uid', type: FieldType.other, config: {}, values: [['prometheus-uid']] },
        { name: 'location', type: FieldType.string, config: {}, values: ['/my-dashboard-1'] },
      ],
    });
    const dataFrames = applyFieldOverrides({
      data: [searchData],
      fieldConfig: { defaults: {}, overrides: [] },
      replaceVariables: (value) => value,
      theme: createTheme(),
    });
    const mockSearchResult: QueryResponse = {
      isItemLoaded: jest.fn().mockReturnValue(true),
      loadMoreItems: jest.fn(),
      totalRows: searchData.length,
      view: new DataFrameView<DashboardQueryResult>(dataFrames[0]),
    };

    it('resolves the datasource via the async instance-settings hook', async () => {
      useDataSourceInstanceSettingsMock.mockReturnValue({
        isLoading: false,
        error: undefined,
        settings: {
          uid: 'prometheus-uid',
          name: 'My Prometheus',
          type: 'prometheus',
          meta: { info: { logos: { small: 'prometheus-logo.svg' } } },
        } as ReturnType<typeof useDataSourceInstanceSettings>['settings'],
      });

      render(
        <SearchResultsTable
          keyboardEvents={mockKeyboardEvents}
          response={mockSearchResult}
          onTagSelected={mockOnTagSelected}
          onDatasourceChange={jest.fn()}
          selection={mockSelection}
          selectionToggle={mockSelectionToggle}
          clearSelection={mockClearSelection}
          height={1000}
          width={1000}
        />
      );
      await screen.findByRole('table');

      expect(useDataSourceInstanceSettingsMock).toHaveBeenCalledWith('prometheus-uid');
      expect(screen.getByText('My Prometheus')).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'Data source' })).toBeInTheDocument();
    });
  });

  describe('when an item was deleted', () => {
    // The second row has no deletion time, which is what an object deleted before those
    // were recorded looks like.
    const searchData = toDataFrame({
      name: 'A',
      fields: [
        {
          name: 'kind',
          type: FieldType.string,
          config: {},
          values: [DashboardSearchItemType.DashDB, DashboardSearchItemType.DashDB],
        },
        { name: 'uid', type: FieldType.string, config: {}, values: ['my-dashboard-1', 'my-dashboard-2'] },
        { name: 'name', type: FieldType.string, config: {}, values: ['My dashboard 1', 'My dashboard 2'] },
        { name: 'panel_type', type: FieldType.string, config: {}, values: ['', ''] },
        { name: 'url', type: FieldType.string, config: {}, values: ['/my-dashboard-1', '/my-dashboard-2'] },
        { name: 'tags', type: FieldType.other, config: {}, values: [[], []] },
        { name: 'ds_uid', type: FieldType.other, config: {}, values: ['', ''] },
        { name: 'location', type: FieldType.string, config: {}, values: ['/my-dashboard-1', '/my-dashboard-2'] },
        {
          name: 'deletionTimestamp',
          type: FieldType.string,
          config: {},
          values: ['2026-09-25T20:43:31.000Z', null],
        },
      ],
    });

    const dataFrames = applyFieldOverrides({
      data: [searchData],
      fieldConfig: { defaults: {}, overrides: [] },
      replaceVariables: (value) => value,
      theme: createTheme(),
    });

    const mockSearchResult: QueryResponse = {
      isItemLoaded: jest.fn().mockReturnValue(true),
      loadMoreItems: jest.fn(),
      totalRows: searchData.length,
      view: new DataFrameView<DashboardQueryResult>(dataFrames[0]),
    };

    it('shows when it was deleted', async () => {
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

      expect(screen.getByRole('columnheader', { name: 'Deleted on' })).toBeInTheDocument();
      // Formatted in the test runner's locale, so match the year rather than a fixed string.
      expect(screen.getByText(/2026/)).toBeInTheDocument();
    });

    it('shows a dash for an item with no deletion time, rather than a loading state', async () => {
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

      expect(screen.getByRole('columnheader', { name: 'Deleted on' })).toBeInTheDocument();
      expect(screen.getByText('-')).toBeInTheDocument();
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
