import { act, renderHook } from '@testing-library/react';
import React from 'react';

import { AlertState } from '@grafana/data';
import { type VizPanel } from '@grafana/scenes';
import { type DataQuery } from '@grafana/schema';
import { mockCombinedRule } from 'app/features/alerting/unified/mocks';

import { type PanelDataPaneNext } from '../PanelDataPaneNext';

import { useActionsContext, useQueryEditorUIContext } from './QueryEditorContext';
import { QueryEditorContextWrapper } from './QueryEditorContextWrapper';
import { type AlertRule, type Transformation } from './types';

jest.mock('../../../utils/utils', () => ({
  getQueryRunnerFor: jest.fn().mockReturnValue(null),
}));

jest.mock('app/features/explore/QueryLibrary/QueryLibraryContext', () => ({
  useQueryLibraryContext: () => ({ isDrawerOpen: false }),
}));

// Mirror usePendingExpression.test.ts so the real usePendingExpression hook (restored via
// requireActual in the regression suite below) imports cleanly.
jest.mock('app/features/expressions/ExpressionDatasource', () => ({
  dataSource: {
    newQuery: jest.fn(() => ({
      refId: '--',
      datasource: { type: '__expr__', uid: '__expr__' },
    })),
  },
}));

jest.mock('app/features/expressions/utils/expressionTypes', () => ({
  getDefaults: jest.fn((query) => query),
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
    wrapper: ({ children }) => React.createElement(QueryEditorContextWrapper, { dataPane, children }),
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

  it('keeps bulk selection when selecting a query card in multi-select mode', () => {
    const { result } = renderWithWrapper(makeMockDataPane());

    act(() => result.current.setMultiSelectMode(true));
    act(() => result.current.toggleQuerySelection({ refId: 'A' } as DataQuery, { multi: true }));
    act(() => result.current.toggleQuerySelection({ refId: 'B' } as DataQuery, { multi: true }));
    expect(result.current.selectedQueryRefIds).toEqual(['A', 'B']);

    act(() => result.current.setSelectedQuery({ refId: 'C' } as DataQuery));

    expect(result.current.selectedQueryRefIds).toEqual(['A', 'B']);
  });

  it('exits multi-select mode when an alert is selected', () => {
    const { result } = renderWithWrapper(makeMockDataPane());

    act(() => result.current.setMultiSelectMode(true));
    expect(result.current.multiSelectMode).toBe(true);

    act(() => result.current.setSelectedAlert(mockAlert));

    expect(result.current.multiSelectMode).toBe(false);
    expect(result.current.selectedQueryRefIds).toEqual([]);
    expect(result.current.selectedTransformationIds).toEqual([]);
  });

  it('clears bulk query and transformation selection when an alert is selected', () => {
    const { result } = renderWithWrapper(makeMockDataPane());

    // Populate bulk arrays via multi-select mode so the assertion is meaningful.
    act(() => result.current.setMultiSelectMode(true));
    act(() => result.current.toggleQuerySelection({ refId: 'A' } as DataQuery, { multi: true }));
    act(() => result.current.toggleQuerySelection({ refId: 'B' } as DataQuery, { multi: true }));
    expect(result.current.selectedQueryRefIds).toEqual(['A', 'B']);

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

describe('QueryEditorContextWrapper - clearSelection', () => {
  beforeEach(() => {
    mockUseAlertRulesForPanel.mockReturnValue({
      alertRules: [mockAlert],
      loading: false,
      isDashboardSaved: true,
    });
  });

  it('exits multi-select mode and empties bulk selection', () => {
    const { result } = renderWithWrapper(makeMockDataPane());

    act(() => result.current.setMultiSelectMode(true));
    act(() => result.current.toggleQuerySelection({ refId: 'A' } as DataQuery, { multi: true }));
    act(() => result.current.toggleQuerySelection({ refId: 'B' } as DataQuery, { multi: true }));
    expect(result.current.multiSelectMode).toBe(true);
    expect(result.current.selectedQueryRefIds).toEqual(['A', 'B']);

    act(() => result.current.clearSelection());

    expect(result.current.multiSelectMode).toBe(false);
    expect(result.current.selectedQueryRefIds).toEqual([]);
    expect(result.current.selectedTransformationIds).toEqual([]);
  });

  it('clears alert selection alongside multi-select mode', () => {
    const { result } = renderWithWrapper(makeMockDataPane());

    act(() => result.current.setSelectedAlert(mockAlert));
    act(() => result.current.clearSelection());

    expect(result.current.selectedAlert).toBeNull();
    expect(result.current.multiSelectMode).toBe(false);
  });
});

describe('QueryEditorContextWrapper - selection toggles', () => {
  beforeEach(() => {
    mockUseAlertRulesForPanel.mockReturnValue({
      alertRules: [],
      loading: false,
      isDashboardSaved: true,
    });
  });

  it('ignores a multi/range toggle while not in multi-select mode', () => {
    const { result } = renderWithWrapper(makeMockDataPane());

    act(() => result.current.toggleQuerySelection({ refId: 'A' } as DataQuery, { multi: true }));

    expect(result.current.multiSelectMode).toBe(false);
    expect(result.current.selectedQueryRefIds).toEqual([]);
  });

  it('activates a query on a plain toggle without entering multi-select mode', () => {
    const { result } = renderWithWrapper(makeMockDataPane());

    act(() => result.current.toggleQuerySelection({ refId: 'A' } as DataQuery));

    expect(result.current.multiSelectMode).toBe(false);
    expect(result.current.selectedQueryRefIds).toEqual([]);
  });

  it('ignores a transformation multi/range toggle while not in multi-select mode', () => {
    const reduce: Transformation = {
      registryItem: undefined,
      transformId: 'reduce-0',
      transformConfig: { id: 'reduce', options: {} },
    };
    const { useTransformations } = require('./hooks/useTransformations');
    useTransformations.mockReturnValue([reduce]);

    const { result } = renderWithWrapper(makeMockDataPane());

    act(() => result.current.toggleTransformationSelection(reduce, { multi: true }));

    expect(result.current.multiSelectMode).toBe(false);
    expect(result.current.selectedTransformationIds).toEqual([]);
  });

  it('activates a transformation on a plain toggle without entering multi-select mode', () => {
    const reduce: Transformation = {
      registryItem: undefined,
      transformId: 'reduce-0',
      transformConfig: { id: 'reduce', options: {} },
    };
    const { useTransformations } = require('./hooks/useTransformations');
    useTransformations.mockReturnValue([reduce]);

    const { result } = renderWithWrapper(makeMockDataPane());

    act(() => result.current.toggleTransformationSelection(reduce));

    expect(result.current.multiSelectMode).toBe(false);
    expect(result.current.selectedTransformation).toEqual(reduce);
    expect(result.current.selectedTransformationIds).toEqual([]);
  });

  it('activates a transformation directly via setSelectedTransformation while in multi-select mode', () => {
    const reduce: Transformation = {
      registryItem: undefined,
      transformId: 'reduce-0',
      transformConfig: { id: 'reduce', options: {} },
    };
    const { useTransformations } = require('./hooks/useTransformations');
    useTransformations.mockReturnValue([reduce]);

    const { result } = renderWithWrapper(makeMockDataPane());

    act(() => result.current.setMultiSelectMode(true));
    act(() => result.current.setSelectedTransformation(reduce));

    // Active editor selection follows the clicked card, bulk selection is left untouched.
    expect(result.current.selectedTransformation).toEqual(reduce);
    expect(result.current.multiSelectMode).toBe(true);
  });

  it('clears the bulk selection when multi-select mode is turned off via setMultiSelectMode', () => {
    const { result } = renderWithWrapper(makeMockDataPane());

    act(() => result.current.setMultiSelectMode(true));
    act(() => result.current.toggleQuerySelection({ refId: 'A' } as DataQuery, { multi: true }));
    expect(result.current.selectedQueryRefIds).toEqual(['A']);

    act(() => result.current.setMultiSelectMode(false));

    expect(result.current.multiSelectMode).toBe(false);
    expect(result.current.selectedQueryRefIds).toEqual([]);
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

    // Populate the bulk array via multi-select; the active path no longer mirrors bulk.
    act(() => result.current.ui.setMultiSelectMode(true));
    act(() => result.current.ui.toggleQuerySelection({ refId: 'A' } as DataQuery, { multi: true }));
    act(() => result.current.ui.toggleQuerySelection({ refId: 'B' } as DataQuery, { multi: true }));
    expect(result.current.ui.selectedQueryRefIds).toEqual(['A', 'B']);

    act(() => result.current.actions.deleteQuery('A'));

    expect(result.current.ui.selectedQueryRefIds).toEqual(['B']);
  });

  it('deleteTransformation removes the deleted id from selectedTransformationIds', () => {
    const { useTransformations } = require('./hooks/useTransformations');
    const mockTransformation: Transformation = {
      registryItem: undefined,
      transformId: 'reduce-0',
      transformConfig: { id: 'reduce', options: {} },
    };
    const otherTransformation: Transformation = {
      registryItem: undefined,
      transformId: 'organize-1',
      transformConfig: { id: 'organize', options: {} },
    };
    useTransformations.mockReturnValue([mockTransformation, otherTransformation]);

    const dataPane = makeMockDataPane();
    const { result } = renderWithBothContexts(dataPane);

    act(() => result.current.ui.setMultiSelectMode(true));
    act(() => result.current.ui.toggleTransformationSelection(mockTransformation, { multi: true }));
    act(() => result.current.ui.toggleTransformationSelection(otherTransformation, { multi: true }));
    expect(result.current.ui.selectedTransformationIds).toEqual(['reduce-0', 'organize-1']);

    act(() => result.current.actions.deleteTransformation('reduce-0'));

    expect(result.current.ui.selectedTransformationIds).toEqual(['organize-1']);
  });
});

// Regression: opening a pending picker (+Expression / +Transformation) while in multi-select
// mode and then cancelling must NOT wipe the bulk selection or silently leave multi-select
// mode on with empty checkboxes. These tests exercise the REAL pending hooks (the suites above
// mock them) to cover the full wrapper -> hook -> selection-state flow.
describe('QueryEditorContextWrapper - pending picker cancel preserves multi-select', () => {
  beforeEach(() => {
    mockUseAlertRulesForPanel.mockReturnValue({
      alertRules: [],
      loading: false,
      isDashboardSaved: true,
    });

    const { usePendingExpression } = require('./hooks/usePendingExpression');
    const { usePendingTransformation } = require('./hooks/usePendingTransformation');
    usePendingExpression.mockImplementation(jest.requireActual('./hooks/usePendingExpression').usePendingExpression);
    usePendingTransformation.mockImplementation(
      jest.requireActual('./hooks/usePendingTransformation').usePendingTransformation
    );
  });

  it('preserves bulk query selection and multi-select mode when cancelling a pending expression', () => {
    const { result } = renderWithWrapper(makeMockDataPane());

    act(() => result.current.setMultiSelectMode(true));
    act(() => result.current.toggleQuerySelection({ refId: 'A' } as DataQuery, { multi: true }));
    act(() => result.current.toggleQuerySelection({ refId: 'B' } as DataQuery, { multi: true }));
    expect(result.current.selectedQueryRefIds).toEqual(['A', 'B']);

    // Open the +Expression picker.
    act(() => result.current.setPendingExpression({ insertAfter: 'B' }));
    expect(result.current.pendingExpression).toEqual({ insertAfter: 'B' });
    // Bulk selection and mode stay intact while the picker is open.
    expect(result.current.selectedQueryRefIds).toEqual(['A', 'B']);
    expect(result.current.multiSelectMode).toBe(true);

    // Cancel the picker.
    act(() => result.current.setPendingExpression(null));

    expect(result.current.pendingExpression).toBeNull();
    expect(result.current.selectedQueryRefIds).toEqual(['A', 'B']);
    expect(result.current.multiSelectMode).toBe(true);
  });

  it('preserves bulk transformation selection and multi-select mode when cancelling a pending transformation', () => {
    const { useTransformations } = require('./hooks/useTransformations');
    const reduce: Transformation = {
      registryItem: undefined,
      transformId: 'reduce-0',
      transformConfig: { id: 'reduce', options: {} },
    };
    const organize: Transformation = {
      registryItem: undefined,
      transformId: 'organize-1',
      transformConfig: { id: 'organize', options: {} },
    };
    useTransformations.mockReturnValue([reduce, organize]);

    const { result } = renderWithWrapper(makeMockDataPane());

    act(() => result.current.setMultiSelectMode(true));
    act(() => result.current.toggleTransformationSelection(reduce, { multi: true }));
    act(() => result.current.toggleTransformationSelection(organize, { multi: true }));
    expect(result.current.selectedTransformationIds).toEqual(['reduce-0', 'organize-1']);

    // Open the +Transformation picker.
    act(() => result.current.setPendingTransformation({ insertAfter: 'organize-1' }));
    expect(result.current.pendingTransformation).toEqual({ insertAfter: 'organize-1' });
    expect(result.current.selectedTransformationIds).toEqual(['reduce-0', 'organize-1']);
    expect(result.current.multiSelectMode).toBe(true);

    // Cancel the picker.
    act(() => result.current.setPendingTransformation(null));

    expect(result.current.pendingTransformation).toBeNull();
    expect(result.current.selectedTransformationIds).toEqual(['reduce-0', 'organize-1']);
    expect(result.current.multiSelectMode).toBe(true);
  });
});
