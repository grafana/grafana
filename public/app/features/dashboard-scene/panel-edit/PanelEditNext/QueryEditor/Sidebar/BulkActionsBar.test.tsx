import { screen, within } from '@testing-library/react';

import type { DataSourceInstanceSettings } from '@grafana/data/types';

import { renderWithQueryEditorProvider } from '../testUtils';
import { type Transformation } from '../types';

import { BulkActionsBar } from './BulkActionsBar';

// Replace DataSourceModal with a minimal test double to avoid loading its full dep tree.
jest.mock('app/features/datasources/components/picker/DataSourceModal', () => ({
  DataSourceModal: ({
    onChange,
    onDismiss,
  }: {
    onChange: (ds: DataSourceInstanceSettings) => void;
    onDismiss: () => void;
  }) => (
    <div data-testid="datasource-modal">
      <button
        onClick={() => onChange({ uid: 'new-ds', type: 'testdata', name: 'New DS' } as DataSourceInstanceSettings)}
      >
        Select DS
      </button>
      <button onClick={onDismiss}>Dismiss DS</button>
    </div>
  ),
}));

const mockQueries = [
  { refId: 'A', datasource: { type: 'prometheus', uid: 'prom-1' } },
  { refId: 'B', datasource: { type: 'prometheus', uid: 'prom-1' } },
  { refId: 'C', datasource: { type: 'prometheus', uid: 'prom-1' } },
];

const mockTransformations: Transformation[] = [
  { transformId: 'tx-0', registryItem: undefined, transformConfig: { id: 'organize', options: {} } },
  { transformId: 'tx-1', registryItem: undefined, transformConfig: { id: 'reduce', options: {} } },
  { transformId: 'tx-2', registryItem: undefined, transformConfig: { id: 'filter', options: {} } },
];

function renderBar(overrides: Parameters<typeof renderWithQueryEditorProvider>[1] = {}) {
  return renderWithQueryEditorProvider(<BulkActionsBar />, {
    queries: mockQueries,
    transformations: mockTransformations,
    ...overrides,
  });
}

describe('BulkActionsBar', () => {
  describe('visibility', () => {
    it('renders nothing when fewer than 2 queries are selected', () => {
      const { container } = renderBar({
        uiStateOverrides: { selectedQueryRefIds: ['A'] },
      });
      expect(container).toBeEmptyDOMElement();
    });

    it('renders nothing when fewer than 2 transformations are selected', () => {
      const { container } = renderBar({
        uiStateOverrides: { selectedTransformationIds: ['tx-0'] },
      });
      expect(container).toBeEmptyDOMElement();
    });

    it('renders nothing when no selection at all', () => {
      const { container } = renderBar({
        uiStateOverrides: { selectedQueryRefIds: [], selectedTransformationIds: [] },
      });
      expect(container).toBeEmptyDOMElement();
    });

    it('renders the toolbar when 2+ queries are selected', () => {
      renderBar({ uiStateOverrides: { selectedQueryRefIds: ['A', 'B'] } });
      expect(screen.getByRole('toolbar', { name: /bulk actions/i })).toBeInTheDocument();
    });

    it('renders the toolbar when 2+ transformations are selected', () => {
      renderBar({ uiStateOverrides: { selectedTransformationIds: ['tx-0', 'tx-1'] } });
      expect(screen.getByRole('toolbar', { name: /bulk actions/i })).toBeInTheDocument();
    });
  });

  describe('clear selection', () => {
    it('calls clearSelection when the clear button is clicked', async () => {
      const clearSelection = jest.fn();
      const { user } = renderBar({
        uiStateOverrides: { selectedQueryRefIds: ['A', 'B'], clearSelection },
      });

      await user.click(screen.getByRole('button', { name: /clear selection/i }));
      expect(clearSelection).toHaveBeenCalledTimes(1);
    });
  });

  describe('query bulk actions', () => {
    describe('delete', () => {
      it('opens a confirmation modal when Delete is clicked', async () => {
        const { user } = renderBar({ uiStateOverrides: { selectedQueryRefIds: ['A', 'B'] } });

        await user.click(screen.getAllByRole('button', { name: /delete/i })[0]);

        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      it('calls bulkDeleteQueries and clearSelection after confirming delete', async () => {
        const bulkDeleteQueries = jest.fn();
        const clearSelection = jest.fn();
        const { user } = renderBar({
          uiStateOverrides: { selectedQueryRefIds: ['A', 'B'], clearSelection },
          actionsOverrides: { bulkDeleteQueries },
        });

        // Open modal
        await user.click(screen.getAllByRole('button', { name: /delete/i })[0]);
        // Confirm inside the dialog
        const dialog = screen.getByRole('dialog');
        await user.click(within(dialog).getByRole('button', { name: /delete/i }));

        expect(bulkDeleteQueries).toHaveBeenCalledWith(['A', 'B']);
        expect(clearSelection).toHaveBeenCalled();
      });

      it('does NOT call bulkDeleteQueries when the modal is dismissed', async () => {
        const bulkDeleteQueries = jest.fn();
        const { user } = renderBar({
          uiStateOverrides: { selectedQueryRefIds: ['A', 'B'] },
          actionsOverrides: { bulkDeleteQueries },
        });

        await user.click(screen.getAllByRole('button', { name: /delete/i })[0]);
        // Dismiss the dialog
        const dialog = screen.getByRole('dialog');
        await user.click(within(dialog).getByRole('button', { name: /cancel/i }));

        expect(bulkDeleteQueries).not.toHaveBeenCalled();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    describe('hide / show', () => {
      it('calls bulkToggleQueriesHide(refIds, true) when no queries are hidden', async () => {
        const bulkToggleQueriesHide = jest.fn();
        const { user } = renderBar({
          uiStateOverrides: { selectedQueryRefIds: ['A', 'B'] },
          actionsOverrides: { bulkToggleQueriesHide },
        });

        // None of the selected queries have hide:true so the button says "Hide"
        await user.click(screen.getByRole('button', { name: /hide/i }));
        expect(bulkToggleQueriesHide).toHaveBeenCalledWith(['A', 'B'], true);
      });

      it('calls bulkToggleQueriesHide(refIds, false) when all selected queries are hidden', async () => {
        const bulkToggleQueriesHide = jest.fn();
        const hiddenQueries = [{ refId: 'A', hide: true }, { refId: 'B', hide: true }, { refId: 'C' }];
        const { user } = renderBar({
          queries: hiddenQueries,
          uiStateOverrides: { selectedQueryRefIds: ['A', 'B'] },
          actionsOverrides: { bulkToggleQueriesHide },
        });

        // All selected queries are hidden — button says "Show"
        await user.click(screen.getByRole('button', { name: /show/i }));
        expect(bulkToggleQueriesHide).toHaveBeenCalledWith(['A', 'B'], false);
      });
    });

    describe('change datasource', () => {
      it('shows the datasource button when all selected queries are non-expression', () => {
        renderBar({ uiStateOverrides: { selectedQueryRefIds: ['A', 'B'] } });
        expect(screen.getByRole('button', { name: /data source/i })).toBeInTheDocument();
      });

      it('hides the datasource button when any selected query is an expression', () => {
        const expressionQueries = [
          { refId: 'A', datasource: { type: '__expr__', uid: '__expr__' } },
          { refId: 'B', datasource: { type: '__expr__', uid: '__expr__' } },
        ];
        renderBar({
          queries: expressionQueries,
          uiStateOverrides: { selectedQueryRefIds: ['A', 'B'] },
        });
        expect(screen.queryByRole('button', { name: /data source/i })).not.toBeInTheDocument();
      });

      it('opens the DataSourceModal when the button is clicked', async () => {
        const { user } = renderBar({ uiStateOverrides: { selectedQueryRefIds: ['A', 'B'] } });

        await user.click(screen.getByRole('button', { name: /data source/i }));
        expect(screen.getByTestId('datasource-modal')).toBeInTheDocument();
      });

      it('calls bulkChangeDataSource and clearSelection when a DS is chosen', async () => {
        const bulkChangeDataSource = jest.fn();
        const clearSelection = jest.fn();
        const { user } = renderBar({
          uiStateOverrides: { selectedQueryRefIds: ['A', 'B'], clearSelection },
          actionsOverrides: { bulkChangeDataSource },
        });

        await user.click(screen.getByRole('button', { name: /data source/i }));
        await user.click(screen.getByRole('button', { name: /select ds/i }));

        expect(bulkChangeDataSource).toHaveBeenCalledWith(['A', 'B'], expect.objectContaining({ uid: 'new-ds' }));
        expect(clearSelection).toHaveBeenCalled();
      });

      it('closes the DataSourceModal after selecting a datasource', async () => {
        const { user } = renderBar({ uiStateOverrides: { selectedQueryRefIds: ['A', 'B'] } });

        await user.click(screen.getByRole('button', { name: /data source/i }));
        await user.click(screen.getByRole('button', { name: /select ds/i }));

        expect(screen.queryByTestId('datasource-modal')).not.toBeInTheDocument();
      });

      it('closes the DataSourceModal without calling bulkChangeDataSource when dismissed', async () => {
        const bulkChangeDataSource = jest.fn();
        const { user } = renderBar({
          uiStateOverrides: { selectedQueryRefIds: ['A', 'B'] },
          actionsOverrides: { bulkChangeDataSource },
        });

        await user.click(screen.getByRole('button', { name: /data source/i }));
        await user.click(screen.getByRole('button', { name: /dismiss ds/i }));

        expect(bulkChangeDataSource).not.toHaveBeenCalled();
        expect(screen.queryByTestId('datasource-modal')).not.toBeInTheDocument();
      });
    });
  });

  describe('transformation bulk actions', () => {
    describe('delete', () => {
      it('opens a confirmation modal when Delete is clicked', async () => {
        const { user } = renderBar({
          uiStateOverrides: { selectedTransformationIds: ['tx-0', 'tx-1'] },
        });

        await user.click(screen.getAllByRole('button', { name: /delete/i })[0]);
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      it('calls bulkDeleteTransformations and clearSelection after confirming', async () => {
        const bulkDeleteTransformations = jest.fn();
        const clearSelection = jest.fn();
        const { user } = renderBar({
          uiStateOverrides: { selectedTransformationIds: ['tx-0', 'tx-1'], clearSelection },
          actionsOverrides: { bulkDeleteTransformations },
        });

        await user.click(screen.getAllByRole('button', { name: /delete/i })[0]);
        const dialog = screen.getByRole('dialog');
        await user.click(within(dialog).getByRole('button', { name: /delete/i }));

        expect(bulkDeleteTransformations).toHaveBeenCalledWith(['tx-0', 'tx-1']);
        expect(clearSelection).toHaveBeenCalled();
      });

      it('does NOT call bulkDeleteTransformations when the modal is dismissed', async () => {
        const bulkDeleteTransformations = jest.fn();
        const { user } = renderBar({
          uiStateOverrides: { selectedTransformationIds: ['tx-0', 'tx-1'] },
          actionsOverrides: { bulkDeleteTransformations },
        });

        await user.click(screen.getAllByRole('button', { name: /delete/i })[0]);
        const dialog = screen.getByRole('dialog');
        await user.click(within(dialog).getByRole('button', { name: /cancel/i }));

        expect(bulkDeleteTransformations).not.toHaveBeenCalled();
      });
    });

    describe('enable / disable', () => {
      it('calls bulkToggleTransformationsDisabled(ids, true) when all are enabled', async () => {
        const bulkToggleTransformationsDisabled = jest.fn();
        const { user } = renderBar({
          uiStateOverrides: { selectedTransformationIds: ['tx-0', 'tx-1'] },
          actionsOverrides: { bulkToggleTransformationsDisabled },
        });

        // Transformations are enabled (no disabled flag), so button says "Disable all"
        await user.click(screen.getByRole('button', { name: /disable all/i }));
        expect(bulkToggleTransformationsDisabled).toHaveBeenCalledWith(['tx-0', 'tx-1'], true);
      });

      it('calls bulkToggleTransformationsDisabled(ids, false) when all are disabled', async () => {
        const bulkToggleTransformationsDisabled = jest.fn();
        const disabledTransformations: Transformation[] = [
          {
            transformId: 'tx-0',
            registryItem: undefined,
            transformConfig: { id: 'organize', options: {}, disabled: true },
          },
          {
            transformId: 'tx-1',
            registryItem: undefined,
            transformConfig: { id: 'reduce', options: {}, disabled: true },
          },
        ];
        const { user } = renderBar({
          transformations: disabledTransformations,
          uiStateOverrides: { selectedTransformationIds: ['tx-0', 'tx-1'] },
          actionsOverrides: { bulkToggleTransformationsDisabled },
        });

        // All selected are disabled — button says "Enable all"
        await user.click(screen.getByRole('button', { name: /enable all/i }));
        expect(bulkToggleTransformationsDisabled).toHaveBeenCalledWith(['tx-0', 'tx-1'], false);
      });
    });
  });
});
