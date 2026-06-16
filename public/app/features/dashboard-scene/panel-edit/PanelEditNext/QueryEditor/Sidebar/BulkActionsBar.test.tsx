import { screen, within } from '@testing-library/react';

import { type DataSourceInstanceSettings } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';

import { renderWithQueryEditorProvider } from '../testUtils';
import { type Transformation } from '../types';

import { BulkActionsBar } from './BulkActionsBar';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

const mockReportInteraction = jest.mocked(reportInteraction);

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
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('visibility', () => {
    it('renders nothing when multi-select mode is off', () => {
      // Bulk arrays may linger; the bar is gated on the explicit multi-select mode.
      const { container } = renderBar({
        uiStateOverrides: { multiSelectMode: false, selectedQueryRefIds: ['A', 'B'] },
      });
      expect(container).toBeEmptyDOMElement();
    });

    it('renders the bar with an exit control and a hint, but no action buttons, when multi-select mode is on but nothing is selected', () => {
      // An empty selection is a valid multi-select state: the bar stays so the user can exit, but
      // there is nothing to act on so only the hint is shown.
      renderBar({
        uiStateOverrides: { multiSelectMode: true, selectedQueryRefIds: [], selectedTransformationIds: [] },
      });
      expect(screen.getByRole('toolbar', { name: /bulk actions/i })).toBeInTheDocument();
      expect(screen.getByText('Select items to apply actions')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /exit multi-select/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /hide/i })).not.toBeInTheDocument();
    });

    it('renders the query action buttons when at least one query is selected in multi-select mode', () => {
      renderBar({
        uiStateOverrides: { multiSelectMode: true, selectedQueryRefIds: ['A'] },
      });
      expect(screen.getByRole('toolbar', { name: /bulk actions/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /hide/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /data source/i })).toBeInTheDocument();
    });

    it('renders the transformation action buttons when at least one transformation is selected in multi-select mode', () => {
      renderBar({
        uiStateOverrides: { multiSelectMode: true, selectedTransformationIds: ['tx-0'] },
      });
      expect(screen.getByRole('toolbar', { name: /bulk actions/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /disable all/i })).toBeInTheDocument();
    });
  });

  describe('clear button', () => {
    it('exits multi-select mode when the clear button is clicked', async () => {
      const setMultiSelectMode = jest.fn();
      const { user } = renderBar({
        uiStateOverrides: {
          multiSelectMode: true,
          selectedQueryRefIds: ['A', 'B'],
          setMultiSelectMode,
        },
      });

      await user.click(screen.getByRole('button', { name: /exit multi-select/i }));

      expect(setMultiSelectMode).toHaveBeenCalledWith(false);
    });

    it('tracks an interaction when the clear button is clicked', async () => {
      const { user } = renderBar({
        uiStateOverrides: {
          multiSelectMode: true,
          selectedQueryRefIds: ['A', 'B'],
        },
      });

      await user.click(screen.getByRole('button', { name: /exit multi-select/i }));

      expect(mockReportInteraction).toHaveBeenCalledWith('grafana_panel_edit_next_interaction', {
        action: 'toggle_multi_select',
        direction: 'exit',
      });
    });
  });

  describe('query bulk actions', () => {
    describe('delete', () => {
      it('opens a confirmation modal when Delete is clicked', async () => {
        const { user } = renderBar({
          uiStateOverrides: { multiSelectMode: true, selectedQueryRefIds: ['A', 'B'] },
        });

        await user.click(screen.getAllByRole('button', { name: /delete/i })[0]);

        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      it('calls bulkDeleteQueries and exits multi-select mode after confirming delete', async () => {
        const bulkDeleteQueries = jest.fn();
        const setMultiSelectMode = jest.fn();
        const { user } = renderBar({
          uiStateOverrides: {
            multiSelectMode: true,
            selectedQueryRefIds: ['A', 'B'],
            setMultiSelectMode,
          },
          actionsOverrides: { bulkDeleteQueries },
        });

        await user.click(screen.getAllByRole('button', { name: /delete/i })[0]);
        const dialog = screen.getByRole('dialog');
        await user.click(within(dialog).getByRole('button', { name: /delete/i }));

        expect(bulkDeleteQueries).toHaveBeenCalledWith(['A', 'B']);
        expect(setMultiSelectMode).toHaveBeenCalledWith(false);
      });

      it('does NOT call bulkDeleteQueries when the modal is dismissed', async () => {
        const bulkDeleteQueries = jest.fn();
        const { user } = renderBar({
          uiStateOverrides: { multiSelectMode: true, selectedQueryRefIds: ['A', 'B'] },
          actionsOverrides: { bulkDeleteQueries },
        });

        await user.click(screen.getAllByRole('button', { name: /delete/i })[0]);
        const dialog = screen.getByRole('dialog');
        await user.click(within(dialog).getByRole('button', { name: /cancel/i }));

        expect(bulkDeleteQueries).not.toHaveBeenCalled();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    describe('hide / show', () => {
      it('calls bulkToggleQueriesHide(refIds, true) and stays in multi-select mode when no queries are hidden', async () => {
        const bulkToggleQueriesHide = jest.fn();
        const setMultiSelectMode = jest.fn();
        const { user } = renderBar({
          uiStateOverrides: { multiSelectMode: true, selectedQueryRefIds: ['A', 'B'], setMultiSelectMode },
          actionsOverrides: { bulkToggleQueriesHide },
        });

        // None of the selected queries have hide:true so the button says "Hide"
        await user.click(screen.getByRole('button', { name: /hide/i }));
        expect(bulkToggleQueriesHide).toHaveBeenCalledWith(['A', 'B'], true);
        // Hide/Show is an in-place toggle — the selection stays so the user can keep acting on it.
        expect(setMultiSelectMode).not.toHaveBeenCalled();
      });

      it('calls bulkToggleQueriesHide(refIds, false) when all selected queries are hidden', async () => {
        const bulkToggleQueriesHide = jest.fn();
        const hiddenQueries = [{ refId: 'A', hide: true }, { refId: 'B', hide: true }, { refId: 'C' }];
        const { user } = renderBar({
          queries: hiddenQueries,
          uiStateOverrides: { multiSelectMode: true, selectedQueryRefIds: ['A', 'B'] },
          actionsOverrides: { bulkToggleQueriesHide },
        });

        // All selected queries are hidden — button says "Show"
        await user.click(screen.getByRole('button', { name: /show/i }));
        expect(bulkToggleQueriesHide).toHaveBeenCalledWith(['A', 'B'], false);
      });
    });

    describe('change datasource', () => {
      it('shows the datasource button when all selected queries are non-expression', () => {
        renderBar({ uiStateOverrides: { multiSelectMode: true, selectedQueryRefIds: ['A', 'B'] } });
        expect(screen.getByRole('button', { name: /data source/i })).toBeInTheDocument();
      });

      it('hides the datasource button when any selected query is an expression', () => {
        const expressionQueries = [
          { refId: 'A', datasource: { type: '__expr__', uid: '__expr__' } },
          { refId: 'B', datasource: { type: '__expr__', uid: '__expr__' } },
        ];
        renderBar({
          queries: expressionQueries,
          uiStateOverrides: { multiSelectMode: true, selectedQueryRefIds: ['A', 'B'] },
        });
        expect(screen.queryByRole('button', { name: /data source/i })).not.toBeInTheDocument();
      });

      it('opens the DataSourceModal when the button is clicked', async () => {
        const { user } = renderBar({
          uiStateOverrides: { multiSelectMode: true, selectedQueryRefIds: ['A', 'B'] },
        });

        await user.click(screen.getByRole('button', { name: /data source/i }));
        expect(screen.getByTestId('datasource-modal')).toBeInTheDocument();
      });

      it('calls bulkChangeDataSource and stays in multi-select mode when a DS is chosen', async () => {
        // Data source change is an in-place modification — the selection stays valid, so the
        // toolbar and multi-select mode persist for further bulk actions. Only Delete exits.
        const bulkChangeDataSource = jest.fn();
        const setMultiSelectMode = jest.fn();
        const { user } = renderBar({
          uiStateOverrides: {
            multiSelectMode: true,
            selectedQueryRefIds: ['A', 'B'],
            setMultiSelectMode,
          },
          actionsOverrides: { bulkChangeDataSource },
        });

        await user.click(screen.getByRole('button', { name: /data source/i }));
        await user.click(screen.getByRole('button', { name: /select ds/i }));

        expect(bulkChangeDataSource).toHaveBeenCalledWith(['A', 'B'], expect.objectContaining({ uid: 'new-ds' }));
        expect(setMultiSelectMode).not.toHaveBeenCalled();
      });

      it('closes the DataSourceModal after selecting a datasource', async () => {
        const { user } = renderBar({
          uiStateOverrides: { multiSelectMode: true, selectedQueryRefIds: ['A', 'B'] },
        });

        await user.click(screen.getByRole('button', { name: /data source/i }));
        await user.click(screen.getByRole('button', { name: /select ds/i }));

        expect(screen.queryByTestId('datasource-modal')).not.toBeInTheDocument();
      });

      it('closes the DataSourceModal without calling bulkChangeDataSource when dismissed', async () => {
        const bulkChangeDataSource = jest.fn();
        const { user } = renderBar({
          uiStateOverrides: { multiSelectMode: true, selectedQueryRefIds: ['A', 'B'] },
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
          uiStateOverrides: { multiSelectMode: true, selectedTransformationIds: ['tx-0', 'tx-1'] },
        });

        await user.click(screen.getAllByRole('button', { name: /delete/i })[0]);
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      it('calls bulkDeleteTransformations and exits multi-select mode after confirming', async () => {
        const bulkDeleteTransformations = jest.fn();
        const setMultiSelectMode = jest.fn();
        const { user } = renderBar({
          uiStateOverrides: {
            multiSelectMode: true,
            selectedTransformationIds: ['tx-0', 'tx-1'],
            setMultiSelectMode,
          },
          actionsOverrides: { bulkDeleteTransformations },
        });

        await user.click(screen.getAllByRole('button', { name: /delete/i })[0]);
        const dialog = screen.getByRole('dialog');
        await user.click(within(dialog).getByRole('button', { name: /delete/i }));

        expect(bulkDeleteTransformations).toHaveBeenCalledWith(['tx-0', 'tx-1']);
        expect(setMultiSelectMode).toHaveBeenCalledWith(false);
      });

      it('does NOT call bulkDeleteTransformations when the modal is dismissed', async () => {
        const bulkDeleteTransformations = jest.fn();
        const { user } = renderBar({
          uiStateOverrides: { multiSelectMode: true, selectedTransformationIds: ['tx-0', 'tx-1'] },
          actionsOverrides: { bulkDeleteTransformations },
        });

        await user.click(screen.getAllByRole('button', { name: /delete/i })[0]);
        const dialog = screen.getByRole('dialog');
        await user.click(within(dialog).getByRole('button', { name: /cancel/i }));

        expect(bulkDeleteTransformations).not.toHaveBeenCalled();
      });
    });

    describe('enable / disable', () => {
      it('calls bulkToggleTransformationsDisabled(ids, true) and stays in multi-select mode when all are enabled', async () => {
        const bulkToggleTransformationsDisabled = jest.fn();
        const setMultiSelectMode = jest.fn();
        const { user } = renderBar({
          uiStateOverrides: { multiSelectMode: true, selectedTransformationIds: ['tx-0', 'tx-1'], setMultiSelectMode },
          actionsOverrides: { bulkToggleTransformationsDisabled },
        });

        // Transformations are enabled (no disabled flag), so button says "Disable all"
        await user.click(screen.getByRole('button', { name: /disable all/i }));
        expect(bulkToggleTransformationsDisabled).toHaveBeenCalledWith(['tx-0', 'tx-1'], true);
        // Enable/Disable is an in-place toggle — the selection persists.
        expect(setMultiSelectMode).not.toHaveBeenCalled();
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
          uiStateOverrides: { multiSelectMode: true, selectedTransformationIds: ['tx-0', 'tx-1'] },
          actionsOverrides: { bulkToggleTransformationsDisabled },
        });

        // All selected are disabled — button says "Enable all"
        await user.click(screen.getByRole('button', { name: /enable all/i }));
        expect(bulkToggleTransformationsDisabled).toHaveBeenCalledWith(['tx-0', 'tx-1'], false);
      });
    });
  });
});
