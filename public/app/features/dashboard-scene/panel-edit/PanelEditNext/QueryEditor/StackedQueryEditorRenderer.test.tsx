import { screen } from '@testing-library/react';

import { DataQuery } from '@grafana/schema';

import { renderWithQueryEditorProvider } from './testUtils';

import { StackedQueryEditorRenderer } from './StackedQueryEditorRenderer';

jest.mock('app/features/query/components/QueryEditorRow', () => ({
  filterPanelDataToQuery: jest.fn(() => undefined),
}));

jest.mock('app/features/query/components/QueryErrorAlert', () => ({
  QueryErrorAlert: ({ error }: { error: { message: string } }) => (
    <div data-testid="query-error-alert">{error.message}</div>
  ),
}));

jest.mock('./hooks/useSelectedQueryDatasource', () => ({
  useSelectedQueryDatasource: () => ({
    selectedQueryDsData: null,
    selectedQueryDsLoading: false,
  }),
}));

jest.mock('app/features/datasources/hooks', () => ({
  useDatasource: () => undefined,
}));

const mockQueries: DataQuery[] = [
  { refId: 'A', datasource: { type: 'prometheus', uid: 'prom-1' } },
  { refId: 'B', datasource: { type: 'prometheus', uid: 'prom-1' } },
  { refId: 'C', datasource: { type: '__expr__', uid: '__expr__' } },
];

describe('StackedQueryEditorRenderer', () => {
  it('renders a header showing the count of selected queries', () => {
    renderWithQueryEditorProvider(<StackedQueryEditorRenderer />, {
      queries: mockQueries,
      uiStateOverrides: {
        isStackedView: true,
        selectedQueryRefIds: ['A', 'B'],
      },
    });

    expect(screen.getByText(/viewing 2 queries/i)).toBeInTheDocument();
  });

  it('renders one stacked item per selected query', () => {
    renderWithQueryEditorProvider(<StackedQueryEditorRenderer />, {
      queries: mockQueries,
      uiStateOverrides: {
        isStackedView: true,
        selectedQueryRefIds: ['A', 'B', 'C'],
      },
    });

    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByText('C')).toBeInTheDocument();
  });

  it('shows "Expression" label for expression queries instead of datasource info', () => {
    renderWithQueryEditorProvider(<StackedQueryEditorRenderer />, {
      queries: mockQueries,
      uiStateOverrides: {
        isStackedView: true,
        selectedQueryRefIds: ['C'],
      },
    });

    expect(screen.getByText('Expression')).toBeInTheDocument();
  });

  it('does not render items for refIds that no longer exist in queries', () => {
    renderWithQueryEditorProvider(<StackedQueryEditorRenderer />, {
      queries: mockQueries,
      uiStateOverrides: {
        isStackedView: true,
        selectedQueryRefIds: ['A', 'GONE'],
      },
    });

    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.queryByText('GONE')).not.toBeInTheDocument();
  });

  it('calls setStackedView(false) and clearSelection when exit button is clicked', async () => {
    const setStackedView = jest.fn();
    const clearSelection = jest.fn();

    const { user } = renderWithQueryEditorProvider(<StackedQueryEditorRenderer />, {
      queries: mockQueries,
      uiStateOverrides: {
        isStackedView: true,
        selectedQueryRefIds: ['A', 'B'],
        setStackedView,
        clearSelection,
      },
    });

    await user.click(screen.getByRole('button', { name: /exit stacked view/i }));

    expect(setStackedView).toHaveBeenCalledWith(false);
    expect(clearSelection).toHaveBeenCalled();
  });
});
