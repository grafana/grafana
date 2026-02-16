import { screen } from '@testing-library/react';

import { DataQuery } from '@grafana/schema';

import { SidebarSize } from '../../constants';
import { renderWithQueryEditorProvider, ds1SettingsMock } from '../testUtils';
import { Transformation } from '../types';

import { QueryEditorSidebar } from './QueryEditorSidebar';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    getInstanceSettings: () => ds1SettingsMock,
  }),
}));

describe('QueryEditorSidebar', () => {
  afterAll(() => {
    jest.clearAllMocks();
  });

  it('should not render transformations section when no transformations exist', () => {
    const queries: DataQuery[] = [{ refId: 'A', datasource: { type: 'test', uid: 'test' } }];

    renderWithQueryEditorProvider(<QueryEditorSidebar sidebarSize={SidebarSize.Full} setSidebarSize={jest.fn()} />, {
      queries,
      selectedQuery: queries[0],
    });

    expect(screen.queryByText(/transformations/i)).not.toBeInTheDocument();
  });

  it('should render queries section even when no queries exist', () => {
    renderWithQueryEditorProvider(<QueryEditorSidebar sidebarSize={SidebarSize.Full} setSidebarSize={jest.fn()} />);

    // Should still render the queries section header
    expect(screen.getByText(/queries & expressions/i)).toBeInTheDocument();
  });

  it('should only render DataTransformerConfig cards and not CustomTransformerDefinition', () => {
    const queries: DataQuery[] = [{ refId: 'A', datasource: { type: 'test', uid: 'test' } }];

    const transformations: Transformation[] = [
      { transformId: 'organize', registryItem: undefined, transformConfig: { id: 'organize', options: {} } },
      { transformId: 'reduce', registryItem: undefined, transformConfig: { id: 'reduce', options: {} } },
    ];

    renderWithQueryEditorProvider(<QueryEditorSidebar sidebarSize={SidebarSize.Full} setSidebarSize={jest.fn()} />, {
      queries,
      transformations,
      selectedQuery: queries[0],
    });

    // Should render both transformation cards
    expect(screen.getByRole('button', { name: /select card organize/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /select card reduce/i })).toBeInTheDocument();

    // Count total transformation cards (should be 2).
    // Filter to "Select card" buttons only, excluding the "Add below" ("+" icon) buttons.
    const transformCards = screen.getAllByRole('button').filter((button) => {
      const label = button.getAttribute('aria-label') || '';
      return label.startsWith('Select card') && (label.includes('organize') || label.includes('reduce'));
    });
    expect(transformCards).toHaveLength(2);
  });

  it('should handle mix of query cards and transformation cards', () => {
    const queries: DataQuery[] = [
      { refId: 'A', datasource: { type: 'test', uid: 'test' } },
      { refId: 'B', datasource: { type: 'test', uid: 'test' } },
    ];

    const transformations: Transformation[] = [
      { transformId: 'organize', registryItem: undefined, transformConfig: { id: 'organize', options: {} } },
    ];

    renderWithQueryEditorProvider(<QueryEditorSidebar sidebarSize={SidebarSize.Full} setSidebarSize={jest.fn()} />, {
      queries,
      transformations,
      selectedQuery: queries[0],
    });

    // Should render both query cards
    expect(screen.getByRole('button', { name: /select card A/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /select card B/i })).toBeInTheDocument();

    // Should render transformation card
    expect(screen.getByRole('button', { name: /select card organize/i })).toBeInTheDocument();
  });

  it('should render "Add below" buttons only for query/expression cards, not transformations', () => {
    const queries: DataQuery[] = [
      { refId: 'A', datasource: { type: 'test', uid: 'test' } },
      { refId: 'B', datasource: { type: 'test', uid: 'test' } },
    ];

    const transformations: Transformation[] = [
      { transformId: 'organize', registryItem: undefined, transformConfig: { id: 'organize', options: {} } },
    ];

    renderWithQueryEditorProvider(<QueryEditorSidebar sidebarSize={SidebarSize.Full} setSidebarSize={jest.fn()} />, {
      queries,
      transformations,
      selectedQuery: queries[0],
    });

    // Query cards should have an "Add below" button
    expect(screen.getByRole('button', { name: /add below A/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add below B/i })).toBeInTheDocument();

    // Transformation cards should NOT have an "Add below" button
    expect(screen.queryByRole('button', { name: /add below organize/i })).not.toBeInTheDocument();
  });
});
