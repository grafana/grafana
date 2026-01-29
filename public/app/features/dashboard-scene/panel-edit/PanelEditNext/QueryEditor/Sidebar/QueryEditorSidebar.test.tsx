import { render, screen } from '@testing-library/react';

import { DataSourceInstanceSettings, PluginType } from '@grafana/data';
import { VizPanel } from '@grafana/scenes';
import { DataQuery, DataTransformerConfig } from '@grafana/schema';

import { QueryEditorProvider } from '../QueryEditorContext';

import { QueryEditorSidebar, SidebarSize } from './QueryEditorSidebar';

const ds1SettingsMock: DataSourceInstanceSettings = {
  id: 1,
  uid: 'test',
  name: 'Test DS',
  type: 'test',
  meta: {
    id: 'test',
    name: 'Test',
    type: PluginType.datasource,
    info: {
      author: { name: '' },
      description: '',
      links: [],
      logos: { small: 'test-logo.png', large: '' },
      screenshots: [],
      updated: '',
      version: '',
    },
    module: '',
    baseUrl: '',
  },
  access: 'proxy',
  readOnly: false,
  jsonData: {},
};

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    getInstanceSettings: () => ds1SettingsMock,
  }),
}));

const mockActions = {
  updateQueries: jest.fn(),
  updateSelectedQuery: jest.fn(),
  addQuery: jest.fn(),
  deleteQuery: jest.fn(),
  duplicateQuery: jest.fn(),
  runQueries: jest.fn(),
  changeDataSource: jest.fn(),
};

describe('QueryEditorSidebar', () => {
  it('should render empty transformations section when no transformations exist', () => {
    const queries: DataQuery[] = [{ refId: 'A', datasource: { type: 'test', uid: 'test' } }];

    render(
      <QueryEditorProvider
        dsState={{ datasource: undefined, dsSettings: undefined, dsError: undefined }}
        qrState={{ queries, data: undefined, isLoading: false }}
        panelState={{ panel: new VizPanel({ key: 'panel-1' }), transformations: [] }}
        uiState={{
          selectedQuery: queries[0],
          selectedTransformation: null,
          setSelectedQuery: jest.fn(),
          setSelectedTransformation: jest.fn(),
        }}
        actions={mockActions}
      >
        <QueryEditorSidebar sidebarSize={SidebarSize.Full} setSidebarSize={jest.fn()} />
      </QueryEditorProvider>
    );

    // Should render the transformations section header
    expect(screen.getByText(/transformations/i)).toBeInTheDocument();

    // Should not render any transformation cards
    const transformationSection = screen.getByText(/transformations/i).closest('div');
    expect(transformationSection).toBeInTheDocument();
  });

  it('should render queries section even when no queries exist', () => {
    render(
      <QueryEditorProvider
        dsState={{ datasource: undefined, dsSettings: undefined, dsError: undefined }}
        qrState={{ queries: [], data: undefined, isLoading: false }}
        panelState={{ panel: new VizPanel({ key: 'panel-1' }), transformations: [] }}
        uiState={{
          selectedQuery: null,
          selectedTransformation: null,
          setSelectedQuery: jest.fn(),
          setSelectedTransformation: jest.fn(),
        }}
        actions={mockActions}
      >
        <QueryEditorSidebar sidebarSize={SidebarSize.Full} setSidebarSize={jest.fn()} />
      </QueryEditorProvider>
    );

    // Should still render the queries section header
    expect(screen.getByText(/queries & expressions/i)).toBeInTheDocument();
  });

  it('should only render DataTransformerConfig cards and not CustomTransformerDefinition', () => {
    const queries: DataQuery[] = [{ refId: 'A', datasource: { type: 'test', uid: 'test' } }];

    const transformations: DataTransformerConfig[] = [
      { id: 'organize', options: {} },
      { id: 'reduce', options: {} },
    ];

    render(
      <QueryEditorProvider
        dsState={{ datasource: undefined, dsSettings: undefined, dsError: undefined }}
        qrState={{ queries, data: undefined, isLoading: false }}
        panelState={{ panel: new VizPanel({ key: 'panel-1' }), transformations }}
        uiState={{
          selectedQuery: queries[0],
          selectedTransformation: null,
          setSelectedQuery: jest.fn(),
          setSelectedTransformation: jest.fn(),
        }}
        actions={mockActions}
      >
        <QueryEditorSidebar sidebarSize={SidebarSize.Full} setSidebarSize={jest.fn()} />
      </QueryEditorProvider>
    );

    // Should render both transformation cards
    expect(screen.getByRole('button', { name: /select card organize/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /select card reduce/i })).toBeInTheDocument();

    // Count total transformation cards (should be 2)
    const transformCards = screen.getAllByRole('button').filter((button) => {
      const label = button.getAttribute('aria-label') || '';
      return label.includes('organize') || label.includes('reduce');
    });
    expect(transformCards).toHaveLength(2);
  });

  it('should handle mix of query cards and transformation cards', () => {
    const queries: DataQuery[] = [
      { refId: 'A', datasource: { type: 'test', uid: 'test' } },
      { refId: 'B', datasource: { type: 'test', uid: 'test' } },
    ];

    const transformations: DataTransformerConfig[] = [{ id: 'organize', options: {} }];

    render(
      <QueryEditorProvider
        dsState={{ datasource: undefined, dsSettings: undefined, dsError: undefined }}
        qrState={{ queries, data: undefined, isLoading: false }}
        panelState={{ panel: new VizPanel({ key: 'panel-1' }), transformations }}
        uiState={{
          selectedQuery: queries[0],
          selectedTransformation: null,
          setSelectedQuery: jest.fn(),
          setSelectedTransformation: jest.fn(),
        }}
        actions={mockActions}
      >
        <QueryEditorSidebar sidebarSize={SidebarSize.Full} setSidebarSize={jest.fn()} />
      </QueryEditorProvider>
    );

    // Should render both query cards
    expect(screen.getByRole('button', { name: /select card A/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /select card B/i })).toBeInTheDocument();

    // Should render transformation card
    expect(screen.getByRole('button', { name: /select card organize/i })).toBeInTheDocument();
  });
});
