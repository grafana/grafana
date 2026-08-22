import { screen } from '@testing-library/react';

import { standardTransformersRegistry } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { type DataQuery } from '@grafana/schema';
import { getStandardTransformers } from 'app/features/transformers/standardTransformers';

import { dashboardDsSettingsMock, ds1SettingsMock, renderWithQueryEditorProvider } from '../testUtils';
import { type Transformation } from '../types';

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

  describe('plugin-registered transformations', () => {
    beforeAll(() => {
      standardTransformersRegistry.setInit(getStandardTransformers);
    });

    const userTransformations: Transformation[] = [
      { transformId: 'organize', registryItem: undefined, transformConfig: { id: 'organize', options: {} } },
    ];

    const systemTransformations = {
      prepend: [{ id: 'limit', options: {} }],
      append: [{ id: 'reduce', options: {} }],
    };

    function renderWithSystemTransformations(transformations = userTransformations) {
      renderWithQueryEditorProvider(<QueriesAndTransformationsView />, {
        transformations,
        panelState: { systemTransformations },
      });

      return screen.getAllByTestId(selectors.components.Transforms.systemTransformationRow);
    }

    it('lists them around the user transformations, in pipeline order', () => {
      const [prepended, appended] = renderWithSystemTransformations();

      // Named from the registry, so the row reads the way the transformation does everywhere else.
      expect(prepended).toHaveTextContent('Limit');
      expect(appended).toHaveTextContent('Reduce');

      // Position is the only thing conveying when each group runs, so it has to be the DOM order and
      // not just the two rows being present.
      const userCard = screen.getByRole('button', { name: /select card organize/i });
      expect(prepended.compareDocumentPosition(userCard)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
      expect(appended.compareDocumentPosition(userCard)).toBe(Node.DOCUMENT_POSITION_PRECEDING);
    });

    it('renders them read-only, with none of the card affordances', () => {
      const [prepended] = renderWithSystemTransformations();

      // A `SidebarCard` is a role=button with delete/hide actions. There is nothing to select here —
      // a system transformation has no editor — and nothing to reorder or remove.
      expect(prepended).not.toHaveAttribute('role', 'button');
      expect(prepended.querySelector('button')).toBeNull();
    });

    it('replaces the empty state when the user has no transformations of their own', () => {
      // The section is showing rows, so "No transformations" would contradict what is on screen.
      expect(renderWithSystemTransformations([])).toHaveLength(2);
      expect(screen.queryByText('No transformations')).not.toBeInTheDocument();
    });
  });

  it('should always render transformations section even when no transformations exist', () => {
    const queries: DataQuery[] = [{ refId: 'A', datasource: { type: 'test', uid: 'test' } }];

    renderWithQueryEditorProvider(<QueriesAndTransformationsView />, {
      queries,
      selectedQuery: queries[0],
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

  it('should disable "Add expression" when panel datasource is dashboard datasource', async () => {
    const queries: DataQuery[] = [{ refId: 'A', datasource: { type: 'dashboard', uid: '-- Dashboard --' } }];

    const { user } = renderWithQueryEditorProvider(<QueriesAndTransformationsView />, {
      queries,
      selectedQuery: queries[0],
      dsState: { dsSettings: dashboardDsSettingsMock },
    });

    await user.click(screen.getByRole('button', { name: /add query or expression/i }));

    expect(screen.getByRole('menuitem', { name: /add expression/i })).toBeDisabled();
  });
});
