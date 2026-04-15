import { screen } from '@testing-library/react';

import { type TransformerRegistryItem } from '@grafana/data';

import { StackedView } from './StackedView';
import { renderWithQueryEditorProvider } from './testUtils';
import { type Transformation } from './types';

jest.mock('./hooks/useSelectedQueryDatasource', () => ({
  useSelectedQueryDatasource: () => ({
    selectedQueryDsData: null,
    selectedQueryDsLoading: false,
  }),
}));

jest.mock('./hooks/useTransformationInputData', () => ({
  useTransformationInputData: () => [],
}));

const mockQueries = [
  { refId: 'A', datasource: { type: 'prometheus', uid: 'prom-1' } },
  { refId: 'B', datasource: { type: 'prometheus', uid: 'prom-1' } },
  { refId: 'C', datasource: { type: 'prometheus', uid: 'prom-1' } },
];

const mockEditor = () => <div data-testid="mock-editor">Editor</div>;

function makeRegistryItem(name: string): TransformerRegistryItem {
  return {
    name,
    editor: mockEditor,
    transformation: { defaultOptions: {} },
  } as unknown as TransformerRegistryItem;
}

const mockTransformations: Transformation[] = [
  {
    transformId: 'tx-0',
    registryItem: makeRegistryItem('Organize fields'),
    transformConfig: { id: 'organize', options: {} },
  },
  {
    transformId: 'tx-1',
    registryItem: makeRegistryItem('Reduce'),
    transformConfig: { id: 'reduce', options: {} },
  },
  {
    transformId: 'tx-2',
    registryItem: makeRegistryItem('Filter'),
    transformConfig: { id: 'filter', options: {} },
  },
];

function renderStackedView(overrides: Parameters<typeof renderWithQueryEditorProvider>[1] = {}) {
  return renderWithQueryEditorProvider(<StackedView />, {
    queries: mockQueries,
    transformations: mockTransformations,
    ...overrides,
  });
}

describe('StackedView', () => {
  describe('queries', () => {
    it('renders an item for each selected query', () => {
      renderStackedView({
        uiStateOverrides: { selectedQueryRefIds: ['A', 'B'] },
      });

      expect(screen.getByRole('article', { name: 'A' })).toBeInTheDocument();
      expect(screen.getByRole('article', { name: 'B' })).toBeInTheDocument();
      expect(screen.queryByRole('article', { name: 'C' })).not.toBeInTheDocument();
    });

    it('renders all selected queries when all are selected', () => {
      renderStackedView({
        uiStateOverrides: { selectedQueryRefIds: ['A', 'B', 'C'] },
      });

      expect(screen.getAllByRole('article')).toHaveLength(3);
    });

    it('preserves query order from the queries array', () => {
      renderStackedView({
        uiStateOverrides: { selectedQueryRefIds: ['C', 'A'] },
      });

      const articles = screen.getAllByRole('article');
      expect(articles[0]).toHaveAccessibleName('A');
      expect(articles[1]).toHaveAccessibleName('C');
    });

    it('shows "Viewing N queries" in the header', () => {
      renderStackedView({
        uiStateOverrides: { selectedQueryRefIds: ['A', 'B'] },
      });

      expect(screen.getByText(/viewing.*2.*queries/i)).toBeInTheDocument();
    });
  });

  describe('transformations', () => {
    it('renders an item for each selected transformation', () => {
      renderStackedView({
        uiStateOverrides: { selectedTransformationIds: ['tx-0', 'tx-1'] },
      });

      expect(screen.getByRole('article', { name: 'Organize fields' })).toBeInTheDocument();
      expect(screen.getByRole('article', { name: 'Reduce' })).toBeInTheDocument();
      expect(screen.queryByRole('article', { name: 'Filter' })).not.toBeInTheDocument();
    });

    it('renders all selected transformations when all are selected', () => {
      renderStackedView({
        uiStateOverrides: { selectedTransformationIds: ['tx-0', 'tx-1', 'tx-2'] },
      });

      expect(screen.getAllByRole('article')).toHaveLength(3);
    });

    it('shows "Viewing N transformations" in the header', () => {
      renderStackedView({
        uiStateOverrides: { selectedTransformationIds: ['tx-0', 'tx-1'] },
      });

      expect(screen.getByText(/viewing.*2.*transformations/i)).toBeInTheDocument();
    });
  });

  describe('exit button', () => {
    it('shows the exit stacked view button', () => {
      renderStackedView({
        uiStateOverrides: { selectedQueryRefIds: ['A', 'B'] },
      });

      expect(screen.getByRole('button', { name: /exit stacked view/i })).toBeInTheDocument();
    });

    it('calls setIsStackedView(false) when exit button is clicked', async () => {
      const setIsStackedView = jest.fn();
      const { user } = renderStackedView({
        uiStateOverrides: { selectedQueryRefIds: ['A', 'B'], setIsStackedView },
      });

      await user.click(screen.getByRole('button', { name: /exit stacked view/i }));
      expect(setIsStackedView).toHaveBeenCalledWith(false);
    });
  });
});
