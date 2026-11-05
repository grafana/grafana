import { screen, waitFor } from '@testing-library/react';

import { reportInteraction } from '@grafana/runtime';
import { type DataQuery } from '@grafana/schema';

import { dashboardDsSettingsMock, ds1SettingsMock, renderWithQueryEditorProvider } from '../testUtils';
import { type Transformation } from '../types';

import { QueriesAndTransformationsView } from './QueriesAndTransformationsView';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    getInstanceSettings: () => ds1SettingsMock,
  }),
  reportInteraction: jest.fn(),
}));

const mockQueryLibrary = { queryLibraryEnabled: false, openDrawer: jest.fn() };

jest.mock('app/features/explore/QueryLibrary/QueryLibraryContext', () => ({
  ...jest.requireActual('app/features/explore/QueryLibrary/QueryLibraryContext'),
  useQueryLibraryContext: () => mockQueryLibrary,
}));

jest.mock('app/features/explore/QueryLibrary/utils/identity', () => ({
  hasSavedQueryReadPermissions: () => true,
}));

const mockReportInteraction = jest.mocked(reportInteraction);

const organizeTransformation: Transformation = {
  transformId: 'organize',
  registryItem: undefined,
  transformConfig: { id: 'organize', options: {} },
};

describe('QueryEditorSidebar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQueryLibrary.queryLibraryEnabled = false;
  });

  it('should always render transformations section even when no transformations exist', async () => {
    const queries: DataQuery[] = [{ refId: 'A', datasource: { type: 'test', uid: 'test' } }];

    renderWithQueryEditorProvider(<QueriesAndTransformationsView />, {
      queries,
      selectedQuery: queries[0],
    });

    await waitFor(() => {
      expect(document.querySelector('[data-rfd-droppable-id="query-sidebar-queries"]')).toBeInTheDocument();
    });

    expect(screen.getByText('Transformations')).toBeInTheDocument();
  });

  it('should render queries section even when no queries exist', () => {
    renderWithQueryEditorProvider(<QueriesAndTransformationsView />);

    // Should still render the queries section header
    expect(screen.getByText(/queries & expressions/i)).toBeInTheDocument();
  });

  it('shows an empty state in each section when there are no cards', () => {
    renderWithQueryEditorProvider(<QueriesAndTransformationsView />, { queries: [], transformations: [] });

    expect(screen.getByText('No queries or expressions')).toBeInTheDocument();
    expect(screen.getByText('No transformations')).toBeInTheDocument();
  });

  it('does not show section empty states when queries exist but transformations do not', () => {
    const queries: DataQuery[] = [{ refId: 'A', datasource: { type: 'test', uid: 'test' } }];

    renderWithQueryEditorProvider(<QueriesAndTransformationsView />, {
      queries,
      transformations: [],
      selectedQuery: queries[0],
    });

    expect(screen.queryByText('No queries or expressions')).not.toBeInTheDocument();
    expect(screen.queryByText('No transformations')).not.toBeInTheDocument();
  });

  it('hides the queries empty state while a pending expression ghost card is shown', () => {
    renderWithQueryEditorProvider(<QueriesAndTransformationsView />, {
      queries: [],
      transformations: [],
      uiStateOverrides: { pendingExpression: { insertAfter: '' } },
    });

    expect(screen.queryByText('No queries or expressions')).not.toBeInTheDocument();
    expect(screen.getByText('No transformations')).toBeInTheDocument();
  });

  it('should only render DataTransformerConfig cards and not CustomTransformerDefinition', () => {
    const queries: DataQuery[] = [{ refId: 'A', datasource: { type: 'test', uid: 'test' } }];

    const transformations: Transformation[] = [
      organizeTransformation,
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

    renderWithQueryEditorProvider(<QueriesAndTransformationsView />, {
      queries,
      transformations: [organizeTransformation],
      selectedQuery: queries[0],
    });

    // Should render both query cards
    expect(screen.getByRole('button', { name: /select card A/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /select card B/i })).toBeInTheDocument();

    // Should render transformation card
    expect(screen.getByRole('button', { name: /select card organize/i })).toBeInTheDocument();
  });

  describe('Queries & Expressions header split button', () => {
    it('adds a query at the end and selects it in one click', async () => {
      const queries: DataQuery[] = [{ refId: 'A', datasource: { type: 'test', uid: 'test' } }];
      const addQuery = jest.fn().mockReturnValue('B');
      const setSelectedQuery = jest.fn();

      const { user } = renderWithQueryEditorProvider(<QueriesAndTransformationsView />, {
        queries,
        selectedQuery: queries[0],
        actionsOverrides: { addQuery },
        uiStateOverrides: { setSelectedQuery },
      });

      await user.click(screen.getByRole('button', { name: 'Add query' }));

      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      expect(addQuery).toHaveBeenCalledWith(undefined, undefined);
      expect(setSelectedQuery).toHaveBeenCalledWith({ refId: 'B', hide: false });
      expect(mockReportInteraction).toHaveBeenCalledWith(
        'grafana_panel_edit_next_interaction',
        { action: 'add_query', source: 'new_query', card_source: 'section_header' },
        undefined
      );
    });

    it('opens a menu with the query options followed by Add transformation', async () => {
      const { user } = renderWithQueryEditorProvider(<QueriesAndTransformationsView />);

      await user.click(screen.getByRole('button', { name: 'More add options' }));

      const itemNames = screen.getAllByRole('menuitem').map((item) => item.textContent);
      expect(itemNames).toEqual(['Add query', 'Add expression', 'Add transformation']);
    });

    it('should expand collapsed queries section when adding an expression', async () => {
      const queries: DataQuery[] = [{ refId: 'A', datasource: { type: 'test', uid: 'test' } }];

      const { user } = renderWithQueryEditorProvider(<QueriesAndTransformationsView />, {
        queries,
        selectedQuery: queries[0],
      });

      await user.click(screen.getByRole('button', { name: /queries & expressions/i }));
      expect(screen.queryByRole('button', { name: /select card A/i })).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'More add options' }));
      await user.click(screen.getByRole('menuitem', { name: /add expression/i }));

      expect(screen.getByRole('button', { name: /select card A/i })).toBeInTheDocument();
    });

    it('should expand collapsed queries section when opening the saved query picker', async () => {
      mockQueryLibrary.queryLibraryEnabled = true;
      const queries: DataQuery[] = [{ refId: 'A', datasource: { type: 'test', uid: 'test' } }];

      const { user } = renderWithQueryEditorProvider(<QueriesAndTransformationsView />, {
        queries,
        selectedQuery: queries[0],
      });

      await user.click(screen.getByRole('button', { name: /queries & expressions/i }));
      expect(screen.queryByRole('button', { name: /select card A/i })).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'More add options' }));
      await user.click(screen.getByRole('menuitem', { name: 'Add saved query' }));

      expect(mockQueryLibrary.openDrawer).toHaveBeenCalled();
      expect(screen.getByRole('button', { name: /select card A/i })).toBeInTheDocument();
    });

    it.each([
      { state: 'collapsed', collapse: true },
      { state: 'open', collapse: false },
    ])('starts the transformation picker from the menu with Transformations $state', async ({ collapse }) => {
      const setPendingTransformation = jest.fn();

      const { user } = renderWithQueryEditorProvider(<QueriesAndTransformationsView />, {
        transformations: [organizeTransformation],
        uiStateOverrides: { setPendingTransformation },
      });

      if (collapse) {
        await user.click(screen.getByRole('button', { name: /^transformations$/i }));
        expect(screen.queryByRole('button', { name: /select card organize/i })).not.toBeInTheDocument();
      }

      await user.click(screen.getByRole('button', { name: 'More add options' }));
      await user.click(screen.getByRole('menuitem', { name: 'Add transformation' }));

      expect(screen.getByRole('button', { name: /select card organize/i })).toBeInTheDocument();
      expect(setPendingTransformation).toHaveBeenCalledWith({ insertAfter: undefined });
      expect(mockReportInteraction).toHaveBeenCalledWith(
        'grafana_panel_edit_next_interaction',
        { action: 'add_transformation_initiated', source: 'section_header' },
        undefined
      );
    });

    it('should disable "Add expression" when panel datasource is dashboard datasource', async () => {
      const queries: DataQuery[] = [{ refId: 'A', datasource: { type: 'dashboard', uid: '-- Dashboard --' } }];

      const { user } = renderWithQueryEditorProvider(<QueriesAndTransformationsView />, {
        queries,
        selectedQuery: queries[0],
        dsState: { dsSettings: dashboardDsSettingsMock },
      });

      await user.click(screen.getByRole('button', { name: 'More add options' }));

      expect(screen.getByRole('menuitem', { name: /add expression/i })).toBeDisabled();
    });
  });

  it('starts the transformation picker from the Transformations header without a menu', async () => {
    const setPendingTransformation = jest.fn();

    const { user } = renderWithQueryEditorProvider(<QueriesAndTransformationsView />, {
      uiStateOverrides: { setPendingTransformation },
    });

    await user.click(screen.getByRole('button', { name: 'Add transformation' }));

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(setPendingTransformation).toHaveBeenCalledWith({ insertAfter: undefined });
    expect(mockReportInteraction).toHaveBeenCalledWith(
      'grafana_panel_edit_next_interaction',
      { action: 'add_transformation_initiated', source: 'section_header' },
      undefined
    );
  });

  it('should render "Add below" buttons for both query/expression and transformation cards', () => {
    const queries: DataQuery[] = [
      { refId: 'A', datasource: { type: 'test', uid: 'test' } },
      { refId: 'B', datasource: { type: 'test', uid: 'test' } },
    ];

    renderWithQueryEditorProvider(<QueriesAndTransformationsView />, {
      queries,
      transformations: [organizeTransformation],
      selectedQuery: queries[0],
    });

    // Query cards should have an "Add below" button
    expect(screen.getByRole('button', { name: /add below A/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add below B/i })).toBeInTheDocument();

    // Transformation cards should also have an add button
    expect(screen.getByRole('button', { name: /add transformation below organize/i })).toBeInTheDocument();
  });
});
