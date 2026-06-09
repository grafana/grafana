import { act, renderHook } from '@testing-library/react';
import React from 'react';

import { AlertState } from '@grafana/data';
import { type VizPanel } from '@grafana/scenes';
import { type DataQuery } from '@grafana/schema';
import { mockCombinedRule } from 'app/features/alerting/unified/mocks';

import { type PanelDataPaneNext } from '../PanelDataPaneNext';
import { QueryEditorType } from '../constants';

import { type StackedEditorItem, useActionsContext, useQueryEditorUIContext } from './QueryEditorContext';
import { QueryEditorContextWrapper } from './QueryEditorContextWrapper';
import { type AlertRule, type Transformation } from './types';

jest.mock('../../../utils/utils', () => ({
  getQueryRunnerFor: jest.fn().mockReturnValue(null),
}));

jest.mock('app/features/explore/QueryLibrary/QueryLibraryContext', () => ({
  useQueryLibraryContext: () => ({ isDrawerOpen: false }),
}));

const mockUseAlertRulesForPanel = jest.fn();
jest.mock('./hooks/useAlertRulesForPanel', () => ({
  useAlertRulesForPanel: (...args: unknown[]) => mockUseAlertRulesForPanel(...args),
}));

jest.mock('./hooks/usePendingExpression', () => ({
  usePendingExpression: jest.fn().mockReturnValue({
    pendingExpression: null,
    setPendingExpression: jest.fn(),
    finalizePendingExpression: jest.fn(),
    clearPendingExpression: jest.fn(),
  }),
}));

jest.mock('./hooks/usePendingTransformation', () => ({
  usePendingTransformation: jest.fn().mockReturnValue({
    pendingTransformation: null,
    setPendingTransformation: jest.fn(),
    finalizePendingTransformation: jest.fn(),
    clearPendingTransformation: jest.fn(),
  }),
}));

jest.mock('./hooks/useQueryOptions', () => ({
  useQueryOptions: jest.fn().mockReturnValue({
    queries: [],
    dataSource: { type: undefined, uid: undefined },
    maxDataPoints: undefined,
    minInterval: undefined,
    timeRange: { from: undefined, shift: undefined, hide: undefined },
  }),
}));

jest.mock('./hooks/useSelectedQueryDatasource', () => ({
  useSelectedQueryDatasource: jest.fn().mockReturnValue({
    selectedQueryDsData: null,
    selectedQueryDsLoading: false,
  }),
}));

jest.mock('./hooks/useTransformations', () => ({
  useTransformations: jest.fn().mockReturnValue([]),
}));

const mockAlert: AlertRule = {
  alertId: 'alert-1',
  rule: mockCombinedRule({ name: 'High CPU Alert' }),
  state: AlertState.Alerting,
};

function makeMockDataPane(): PanelDataPaneNext {
  const mockPanel = { state: { $data: {} } } as unknown as VizPanel;
  const mockPanelRef = { resolve: () => mockPanel };

  return {
    useState: () => ({
      panelRef: mockPanelRef,
      datasource: undefined,
      dsSettings: undefined,
      dsError: undefined,
    }),
    updateQueries: jest.fn(),
    updateSelectedQuery: jest.fn(),
    addQuery: jest.fn(),
    deleteQuery: jest.fn(),
    duplicateQuery: jest.fn(),
    toggleQueryHide: jest.fn(),
    runQueries: jest.fn(),
    changeDataSource: jest.fn(),
    onQueryOptionsChange: jest.fn(),
    addTransformation: jest.fn(),
    deleteTransformation: jest.fn(),
    toggleTransformationDisabled: jest.fn(),
    updateTransformation: jest.fn(),
    reorderTransformations: jest.fn(),
  } as unknown as PanelDataPaneNext;
}

function renderWithWrapper(dataPane: PanelDataPaneNext) {
  return renderHook(() => useQueryEditorUIContext(), {
    wrapper: ({ children }) =>
      React.createElement(QueryEditorContextWrapper, {
        dataPane,
        children,
      }),
  });
}

// ---- Tests ----

describe('QueryEditorContextWrapper - side effect clearing', () => {
  beforeEach(() => {
    mockUseAlertRulesForPanel.mockReturnValue({
      alertRules: [],
      loading: false,
      isDashboardSaved: true,
    });
  });

  it('clears pending expression when selecting a query', () => {
    const { usePendingExpression } = require('./hooks/usePendingExpression');
    const { result } = renderWithWrapper(makeMockDataPane());
    const { clearPendingExpression } = usePendingExpression.mock.results[0].value;

    act(() => result.current.setSelectedQuery({ refId: 'A' } as DataQuery));

    expect(clearPendingExpression).toHaveBeenCalled();
  });
});

describe('QueryEditorContextWrapper - alert selection', () => {
  beforeEach(() => {
    mockUseAlertRulesForPanel.mockReturnValue({
      alertRules: [mockAlert],
      loading: false,
      isDashboardSaved: true,
    });
  });

  it('sets selectedAlert when setSelectedAlert is called with an alert', () => {
    const { result } = renderWithWrapper(makeMockDataPane());

    expect(result.current.selectedAlert).toBeNull();

    act(() => result.current.setSelectedAlert(mockAlert));

    expect(result.current.selectedAlert).toEqual(mockAlert);
  });

  it('clears selectedAlert when setSelectedAlert is called with null', () => {
    const { result } = renderWithWrapper(makeMockDataPane());

    act(() => result.current.setSelectedAlert(mockAlert));
    expect(result.current.selectedAlert).toEqual(mockAlert);

    act(() => result.current.setSelectedAlert(null));
    expect(result.current.selectedAlert).toBeNull();
  });

  it('clears query and transformation selection when an alert is selected', () => {
    const { result } = renderWithWrapper(makeMockDataPane());

    // Establish a non-empty query selection first so the assertion is meaningful
    act(() => result.current.setSelectedQuery({ refId: 'A' } as DataQuery));
    expect(result.current.selectedQueryRefIds).toEqual(['A']);

    act(() => result.current.setSelectedAlert(mockAlert));

    expect(result.current.selectedQueryRefIds).toEqual([]);
    expect(result.current.selectedTransformationIds).toEqual([]);
    expect(result.current.selectedAlert).toEqual(mockAlert);
  });

  it('clears alert selection when a query is selected', () => {
    const { result } = renderWithWrapper(makeMockDataPane());

    act(() => result.current.setSelectedAlert(mockAlert));
    expect(result.current.selectedAlert).toEqual(mockAlert);

    act(() => result.current.setSelectedQuery({ refId: 'A' } as DataQuery));

    expect(result.current.selectedAlert).toBeNull();
  });
});

function renderWithBothContexts(dataPane: PanelDataPaneNext) {
  return renderHook(
    () => ({
      ui: useQueryEditorUIContext(),
      actions: useActionsContext(),
    }),
    {
      wrapper: ({ children }) => React.createElement(QueryEditorContextWrapper, { dataPane, children }),
    }
  );
}

describe('QueryEditorContextWrapper - delete confirmation', () => {
  beforeEach(() => {
    mockUseAlertRulesForPanel.mockReturnValue({
      alertRules: [],
      loading: false,
      isDashboardSaved: true,
    });
  });

  it('starts with no action in the intermediate confirmation state', () => {
    const { result } = renderWithWrapper(makeMockDataPane());
    expect(result.current.confirmingDeleteActionKey).toBeNull();
  });

  it('records the most recently set action key and clears it on null', () => {
    const { result } = renderWithWrapper(makeMockDataPane());

    act(() => result.current.setConfirmingDeleteActionKey('sidebar_card:query:A'));
    expect(result.current.confirmingDeleteActionKey).toBe('sidebar_card:query:A');

    act(() => result.current.setConfirmingDeleteActionKey('content_header:query:B'));
    expect(result.current.confirmingDeleteActionKey).toBe('content_header:query:B');

    act(() => result.current.setConfirmingDeleteActionKey(null));
    expect(result.current.confirmingDeleteActionKey).toBeNull();
  });

  it('dismisses an open confirmation when the selected query changes', () => {
    const { result } = renderWithWrapper(makeMockDataPane());

    act(() => result.current.setConfirmingDeleteActionKey('sidebar_card:query:A'));
    expect(result.current.confirmingDeleteActionKey).toBe('sidebar_card:query:A');

    act(() => result.current.setSelectedQuery({ refId: 'A' } as DataQuery));

    expect(result.current.confirmingDeleteActionKey).toBeNull();
  });

  it('dismisses an open confirmation when the selected transformation changes', () => {
    const { useTransformations } = require('./hooks/useTransformations');
    const mockTransformation: Transformation = {
      registryItem: undefined,
      transformId: 'reduce-0',
      transformConfig: { id: 'reduce', options: {} },
    };
    useTransformations.mockReturnValue([mockTransformation]);

    const { result } = renderWithWrapper(makeMockDataPane());

    act(() => result.current.setConfirmingDeleteActionKey('sidebar_card:transformation:reduce-0'));
    expect(result.current.confirmingDeleteActionKey).toBe('sidebar_card:transformation:reduce-0');

    act(() => result.current.setSelectedTransformation(mockTransformation));

    expect(result.current.confirmingDeleteActionKey).toBeNull();
  });

  it('dismisses an open confirmation when the selected alert changes', () => {
    mockUseAlertRulesForPanel.mockReturnValue({
      alertRules: [mockAlert],
      loading: false,
      isDashboardSaved: true,
    });
    const { result } = renderWithWrapper(makeMockDataPane());

    act(() => result.current.setConfirmingDeleteActionKey('sidebar_card:query:A'));
    expect(result.current.confirmingDeleteActionKey).toBe('sidebar_card:query:A');

    act(() => result.current.setSelectedAlert(mockAlert));

    expect(result.current.confirmingDeleteActionKey).toBeNull();
  });

  it('dismisses an open confirmation when selection is cleared', () => {
    const { result } = renderWithWrapper(makeMockDataPane());

    act(() => result.current.setConfirmingDeleteActionKey('sidebar_card:query:A'));
    expect(result.current.confirmingDeleteActionKey).toBe('sidebar_card:query:A');

    act(() => result.current.clearSelection());

    expect(result.current.confirmingDeleteActionKey).toBeNull();
  });
});

describe('QueryEditorContextWrapper - delete actions', () => {
  beforeEach(() => {
    mockUseAlertRulesForPanel.mockReturnValue({
      alertRules: [],
      loading: false,
      isDashboardSaved: true,
    });
  });

  it('deleteQuery removes the deleted refId from selectedQueryRefIds', () => {
    const dataPane = makeMockDataPane();
    const { result } = renderWithBothContexts(dataPane);

    act(() => result.current.ui.setSelectedQuery({ refId: 'A' } as DataQuery));
    expect(result.current.ui.selectedQueryRefIds).toEqual(['A']);

    act(() => result.current.actions.deleteQuery('A'));

    expect(result.current.ui.selectedQueryRefIds).toEqual([]);
  });

  it('deleteTransformation removes the deleted id from selectedTransformationIds', () => {
    const { useTransformations } = require('./hooks/useTransformations');
    const mockTransformation: Transformation = {
      registryItem: undefined,
      transformId: 'reduce-0',
      transformConfig: { id: 'reduce', options: {} },
    };
    useTransformations.mockReturnValue([mockTransformation]);

    const dataPane = makeMockDataPane();
    const { result } = renderWithBothContexts(dataPane);

    act(() => result.current.ui.setSelectedTransformation(mockTransformation));
    expect(result.current.ui.selectedTransformationIds).toEqual(['reduce-0']);

    act(() => result.current.actions.deleteTransformation('reduce-0'));

    expect(result.current.ui.selectedTransformationIds).toEqual([]);
  });
});

type PickerResult = Pick<
  ReturnType<typeof useQueryEditorUIContext>,
  'setPendingExpression' | 'setPendingTransformation' | 'setPendingSavedQuery'
>;

describe('QueryEditorContextWrapper - stacked mode', () => {
  beforeEach(() => {
    mockUseAlertRulesForPanel.mockReturnValue({
      alertRules: [],
      loading: false,
      isDashboardSaved: true,
    });
  });

  it('selects a clicked query as a single selection in stacked mode (scrolling is the renderer’s job)', () => {
    const dataPane = makeMockDataPane();
    const { result } = renderWithWrapper(dataPane);

    act(() => result.current.stackedMode.enter());
    act(() => result.current.toggleQuerySelection({ refId: 'B' } as DataQuery));

    expect(result.current.selectedQueryRefIds).toEqual(['B']);
  });

  it('selects a clicked transformation as a single selection in stacked mode', () => {
    const { useTransformations } = require('./hooks/useTransformations');
    const mockTransformation: Transformation = {
      registryItem: undefined,
      transformId: 'reduce-0',
      transformConfig: { id: 'reduce', options: {} },
    };
    useTransformations.mockReturnValue([mockTransformation]);

    const { result } = renderWithWrapper(makeMockDataPane());

    act(() => result.current.stackedMode.enter());
    act(() => result.current.toggleTransformationSelection(mockTransformation));

    expect(result.current.selectedTransformationIds).toEqual(['reduce-0']);
  });

  it('syncStackedActiveItem mirrors observer-driven activations into the card selection', () => {
    const { result } = renderWithWrapper(makeMockDataPane());

    const queryItem: StackedEditorItem = { type: QueryEditorType.Query, id: 'A' };
    act(() => result.current.stackedMode.syncActiveItem(queryItem));
    expect(result.current.selectedQueryRefIds).toEqual(['A']);
    expect(result.current.selectedTransformationIds).toEqual([]);

    const transformItem: StackedEditorItem = { type: QueryEditorType.Transformation, id: 'reduce-0' };
    act(() => result.current.stackedMode.syncActiveItem(transformItem));
    expect(result.current.selectedQueryRefIds).toEqual([]);
    expect(result.current.selectedTransformationIds).toEqual(['reduce-0']);
  });

  it('exits stacked mode when an alert is selected', () => {
    mockUseAlertRulesForPanel.mockReturnValue({
      alertRules: [mockAlert],
      loading: false,
      isDashboardSaved: true,
    });
    const { result } = renderWithWrapper(makeMockDataPane());

    act(() => result.current.stackedMode.enter());
    expect(result.current.stackedMode.enabled).toBe(true);

    act(() => result.current.setSelectedAlert(mockAlert));

    expect(result.current.stackedMode.enabled).toBe(false);
  });

  it('entering stacked mode collapses existing multi-selection to the primary item', () => {
    const dataPane = makeMockDataPane();
    const { result } = renderWithWrapper(dataPane);

    act(() => result.current.toggleQuerySelection({ refId: 'A' } as DataQuery));
    act(() => result.current.toggleQuerySelection({ refId: 'B' } as DataQuery, { multi: true }));
    act(() => result.current.setMultiSelectMode(true));

    expect(result.current.selectedQueryRefIds).toEqual(['A', 'B']);
    expect(result.current.multiSelectMode).toBe(true);

    act(() => result.current.stackedMode.enter());

    expect(result.current.multiSelectMode).toBe(false);
    expect(result.current.selectedQueryRefIds).toEqual(['B']);
  });

  it('entering multi-select mode exits stacked mode', () => {
    const dataPane = makeMockDataPane();
    const { result } = renderWithWrapper(dataPane);

    act(() => result.current.stackedMode.enter());
    expect(result.current.stackedMode.enabled).toBe(true);

    act(() => result.current.setMultiSelectMode(true));

    expect(result.current.multiSelectMode).toBe(true);
    expect(result.current.stackedMode.enabled).toBe(false);
  });

  // Opening a picker temporarily swaps to the single pane (expression/transformation) or a
  // drawer (saved query); stacked mode must survive so the stack resumes once it resolves.
  it.each([
    { kind: 'expression', open: (r: PickerResult) => r.setPendingExpression({ insertAfter: 'A' }) },
    { kind: 'transformation', open: (r: PickerResult) => r.setPendingTransformation({ insertAfter: 'A' }) },
    { kind: 'saved query', open: (r: PickerResult) => r.setPendingSavedQuery({ insertAfter: 'A' }) },
  ])('keeps stacked mode on when the $kind picker opens', ({ open }) => {
    const { result } = renderWithWrapper(makeMockDataPane());

    act(() => result.current.stackedMode.enter());
    expect(result.current.stackedMode.enabled).toBe(true);

    act(() => open(result.current));

    expect(result.current.stackedMode.enabled).toBe(true);
  });
});
