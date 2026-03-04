import { screen } from '@testing-library/react';

import { DataQuery } from '@grafana/schema';

import { ds1SettingsMock, renderWithQueryEditorProvider } from '../testUtils';
import { Transformation } from '../types';

import { QueriesAndTransformationsView } from './QueriesAndTransformationsView';

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

  it('should render loading bar when data is loading', () => {
    renderWithQueryEditorProvider(<QueriesAndTransformationsView />, {
      qrState: {
        isLoading: true,
      },
    });

    expect(screen.getByLabelText(/loading queries and transformations/i)).toBeInTheDocument();
  });

  it('should always render transformations section even when no transformations exist', () => {
    const queries: DataQuery[] = [{ refId: 'A', datasource: { type: 'test', uid: 'test' } }];

    renderWithQueryEditorProvider(<QueriesAndTransformationsView />, {
      queries,
      selectedQuery: queries[0],
    });

    expect(screen.getByText(/transformations/i)).toBeInTheDocument();
  });

  it('should render queries section even when no queries exist', () => {
    renderWithQueryEditorProvider(<QueriesAndTransformationsView />);

    // Should still render the queries section header
    expect(screen.getByText(/queries & expressions/i)).toBeInTheDocument();
  });

  it('should only render DataTransformerConfig cards and not CustomTransformerDefinition', () => {
    const queries: DataQuery[] = [{ refId: 'A', datasource: { type: 'test', uid: 'test' } }];

    const transformations: Transformation[] = [
      { transformId: 'organize', registryItem: undefined, transformConfig: { id: 'organize', options: {} } },
      { transformId: 'reduce', registryItem: undefined, transformConfig: { id: 'reduce', options: {} } },
    ];

    renderWithQueryEditorProvider(<QueriesAndTransformationsView />, {
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

    renderWithQueryEditorProvider(<QueriesAndTransformationsView />, {
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

  it('should expand collapsed queries section when adding an expression', async () => {
    const queries: DataQuery[] = [{ refId: 'A', datasource: { type: 'test', uid: 'test' } }];

    const { user } = renderWithQueryEditorProvider(<QueriesAndTransformationsView />, {
      queries,
      selectedQuery: queries[0],
    });

    // Verify query card is visible
    expect(screen.getByRole('button', { name: /select card A/i })).toBeInTheDocument();

    // Collapse the "Queries & Expressions" section
    await user.click(screen.getByRole('button', { name: /queries & expressions/i }));

    // Query card should be unmounted
    expect(screen.queryByRole('button', { name: /select card A/i })).not.toBeInTheDocument();

    // Click the header "+" button to open the add menu
    await user.click(screen.getByRole('button', { name: /add query or expression/i }));

    // Click "Add expression" from the dropdown
    await user.click(screen.getByRole('menuitem', { name: /add expression/i }));

    // Section should now be expanded — query card is visible again
    expect(screen.getByRole('button', { name: /select card A/i })).toBeInTheDocument();
  });

  it('should render "Add below" buttons for both query/expression and transformation cards', () => {
    const queries: DataQuery[] = [
      { refId: 'A', datasource: { type: 'test', uid: 'test' } },
      { refId: 'B', datasource: { type: 'test', uid: 'test' } },
    ];

    const transformations: Transformation[] = [
      { transformId: 'organize', registryItem: undefined, transformConfig: { id: 'organize', options: {} } },
    ];

    renderWithQueryEditorProvider(<QueriesAndTransformationsView />, {
      queries,
      transformations,
      selectedQuery: queries[0],
    });

    // Query cards should have an "Add below" button
    expect(screen.getByRole('button', { name: /add below A/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add below B/i })).toBeInTheDocument();

    // Transformation cards should also have an add button
    expect(screen.getByRole('button', { name: /add transformation below organize/i })).toBeInTheDocument();
  });
});
