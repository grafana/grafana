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
    wrapper: ({ children }) =>
      React.createElement(QueryEditorContextWrapper, {
        dataPane,
        children,
      }),
  });
}

// Multi-select can only be entered when there are cards to seed, so tests that exercise it
// must expose queries through the (otherwise null) query runner.
function mockQueryRunnerQueries(queries: DataQuery[]) {
  const { getQueryRunnerFor } = require('../../../utils/utils');
  getQueryRunnerFor.mockReturnValue({ useState: () => ({ queries }) });
}

// Restore the defaults (no query runner, no transformations) after every test so cards set by
// one test can't leak into the next and silently satisfy the "has cards" multi-select guard.
afterEach(() => {
  const { getQueryRunnerFor } = require('../../../utils/utils');
  getQueryRunnerFor.mockReturnValue(null);
  const { useTransformations } = require('./hooks/useTransformations');
  useTransformations.mockReturnValue([]);
});

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
    mockQueryRunnerQueries([{ refId: 'A' }, { refId: 'B' }] as DataQuery[]);
    const { result } = renderWithWrapper(makeMockDataPane());

    // Entering multi-select seeds the active card (A); Cmd+click B to build a two-item selection.
    act(() => result.current.setMultiSelectMode(true));
    act(() => result.current.toggleQuerySelection({ refId: 'B' } as DataQuery, { multi: true }));
    expect(result.current.selectedQueryRefIds).toEqual(['A', 'B']);

    act(() => result.current.setSelectedQuery({ refId: 'C' } as DataQuery));

    expect(result.current.selectedQueryRefIds).toEqual(['A', 'B']);
  });

  it('exits multi-select mode when an alert is selected', () => {
    mockQueryRunnerQueries([{ refId: 'A' }] as DataQuery[]);
    const { result } = renderWithWrapper(makeMockDataPane());

    act(() => result.current.setMultiSelectMode(true));
    expect(result.current.multiSelectMode).toBe(true);

    act(() => result.current.setSelectedAlert(mockAlert));

    expect(result.current.multiSelectMode).toBe(false);
    expect(result.current.selectedQueryRefIds).toEqual([]);
    expect(result.current.selectedTransformationIds).toEqual([]);
  });

  it('clears bulk query and transformation selection when an alert is selected', () => {
    mockQueryRunnerQueries([{ refId: 'A' }, { refId: 'B' }] as DataQuery[]);
    const { result } = renderWithWrapper(makeMockDataPane());

    // Populate bulk arrays via multi-select mode so the assertion is meaningful. Entering
    // multi-select seeds the active card (A); Cmd+click B to build a two-item selection.
    act(() => result.current.setMultiSelectMode(true));
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
    mockQueryRunnerQueries([{ refId: 'A' }, { refId: 'B' }] as DataQuery[]);
    const { result } = renderWithWrapper(makeMockDataPane());

    // Entering multi-select seeds the active card (A); Cmd+click B to build a two-item selection.
    act(() => result.current.setMultiSelectMode(true));
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
    mockQueryRunnerQueries([{ refId: 'A' }] as DataQuery[]);
    const { result } = renderWithWrapper(makeMockDataPane());

    // Entering multi-select seeds the active card (A) into the bulk selection.
    act(() => result.current.setMultiSelectMode(true));
    expect(result.current.selectedQueryRefIds).toEqual(['A']);

    act(() => result.current.setMultiSelectMode(false));

    expect(result.current.multiSelectMode).toBe(false);
    expect(result.current.selectedQueryRefIds).toEqual([]);
  });

  it('keeps multi-select mode active with an empty selection when the last card is unchecked', () => {
    mockQueryRunnerQueries([{ refId: 'A' }, { refId: 'B' }] as DataQuery[]);
    const { result } = renderWithWrapper(makeMockDataPane());

    // Entering multi-select seeds the active card (A).
    act(() => result.current.setMultiSelectMode(true));
    expect(result.current.selectedQueryRefIds).toEqual(['A']);

    // Unchecking the only selected card empties the bulk set but stays in multi-select mode.
    act(() => result.current.toggleQuerySelection({ refId: 'A' } as DataQuery, { multi: true }));
    expect(result.current.selectedQueryRefIds).toEqual([]);
    expect(result.current.multiSelectMode).toBe(true);

    // The empty state is recoverable: checking another card resumes a normal selection.
    act(() => result.current.toggleQuerySelection({ refId: 'B' } as DataQuery, { multi: true }));
    expect(result.current.selectedQueryRefIds).toEqual(['B']);
    expect(result.current.multiSelectMode).toBe(true);
  });

  it('keeps multi-select mode active with an empty transformation selection when the last card is unchecked', () => {
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
    const { useTransformations } = require('./hooks/useTransformations');
    useTransformations.mockReturnValue([reduce, organize]);

    const { result } = renderWithWrapper(makeMockDataPane());

    // Activate a transformation so entering multi-select seeds it into the bulk set.
    act(() => result.current.setSelectedTransformation(reduce));
    act(() => result.current.setMultiSelectMode(true));
    expect(result.current.selectedTransformationIds).toEqual(['reduce-0']);

    // Unchecking the only selected card empties the bulk set but stays in multi-select mode.
    act(() => result.current.toggleTransformationSelection(reduce, { multi: true }));
    expect(result.current.selectedTransformationIds).toEqual([]);
    expect(result.current.multiSelectMode).toBe(true);

    // The empty state is recoverable: checking another card resumes a normal selection.
    act(() => result.current.toggleTransformationSelection(organize, { multi: true }));
    expect(result.current.selectedTransformationIds).toEqual(['organize-1']);
    expect(result.current.multiSelectMode).toBe(true);
  });

  it('does not enter multi-select mode when there are no queries or transformations', () => {
    // No query runner queries and no transformations: there is nothing to seed, so a later
    // added card would arrive unchecked. Entering multi-select must be refused.
    const { result } = renderWithWrapper(makeMockDataPane());

    act(() => result.current.setMultiSelectMode(true));

    expect(result.current.multiSelectMode).toBe(false);
    expect(result.current.selectedQueryRefIds).toEqual([]);
    expect(result.current.selectedTransformationIds).toEqual([]);
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

  it('exits multi-select mode and clears the bulk selection when a query is deleted from its header', () => {
    mockQueryRunnerQueries([{ refId: 'A' }, { refId: 'B' }] as DataQuery[]);
    const dataPane = makeMockDataPane();
    const { result } = renderWithBothContexts(dataPane);

    // Entering multi-select seeds the active card (A); Cmd+click B to build a two-item selection.
    act(() => result.current.ui.setMultiSelectMode(true));
    act(() => result.current.ui.toggleQuerySelection({ refId: 'B' } as DataQuery, { multi: true }));
    expect(result.current.ui.multiSelectMode).toBe(true);
    expect(result.current.ui.selectedQueryRefIds).toEqual(['A', 'B']);

    act(() => result.current.actions.deleteQuery('A'));

    expect(result.current.ui.multiSelectMode).toBe(false);
    expect(result.current.ui.selectedQueryRefIds).toEqual([]);
  });

  it('exits multi-select mode and clears the bulk selection when a transformation is deleted from its header', () => {
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
    expect(result.current.ui.multiSelectMode).toBe(true);
    expect(result.current.ui.selectedTransformationIds).toEqual(['reduce-0', 'organize-1']);

    act(() => result.current.actions.deleteTransformation('reduce-0'));

    expect(result.current.ui.multiSelectMode).toBe(false);
    expect(result.current.ui.selectedTransformationIds).toEqual([]);
  });

  it('seeds the promoted transformation when re-entering multi-select after a header delete', () => {
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

    const { result } = renderWithBothContexts(makeMockDataPane());

    // Activate a transformation and enter multi-select so it is seeded/checked.
    act(() => result.current.ui.setSelectedTransformation(reduce));
    act(() => result.current.ui.setMultiSelectMode(true));
    expect(result.current.ui.selectedTransformationIds).toEqual(['reduce-0']);

    // Deleting it from the header exits multi-select and promotes the remaining transformation.
    act(() => result.current.actions.deleteTransformation('reduce-0'));
    expect(result.current.ui.multiSelectMode).toBe(false);

    // Re-entering multi-select seeds the promoted (active) card, so it is checked rather than
    // highlighted-but-unchecked.
    act(() => result.current.ui.setMultiSelectMode(true));
    expect(result.current.ui.multiSelectMode).toBe(true);
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
    mockQueryRunnerQueries([{ refId: 'A' }, { refId: 'B' }] as DataQuery[]);
    const { result } = renderWithWrapper(makeMockDataPane());

    // Entering multi-select seeds the active card (A); Cmd+click B to build a two-item selection.
    act(() => result.current.setMultiSelectMode(true));
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

type PickerResult = Pick<
  ReturnType<typeof useQueryEditorUIContext>,
  'setPendingExpression' | 'setPendingTransformation' | 'setPendingSavedQuery'
>;

describe('QueryEditorContextWrapper - stacked mode', () => {
  const stackedQueries = [{ refId: 'A' }, { refId: 'B' }] as DataQuery[];

  beforeEach(() => {
    mockUseAlertRulesForPanel.mockReturnValue({
      alertRules: [],
      loading: false,
      isDashboardSaved: true,
    });
    // Stacked mode is single-select and drives the active card (selectedQuery /
    // selectedTransformation), so the query runner must expose real queries for the active
    // selection to resolve through useSelectedCard.
    const { getQueryRunnerFor } = require('../../../utils/utils');
    getQueryRunnerFor.mockReturnValue({ useState: () => ({ queries: stackedQueries }) });
  });

  afterEach(() => {
    const { getQueryRunnerFor } = require('../../../utils/utils');
    getQueryRunnerFor.mockReturnValue(null);
  });

  it('selects a clicked query as a single selection in stacked mode (scrolling is the renderer’s job)', () => {
    const dataPane = makeMockDataPane();
    const { result } = renderWithWrapper(dataPane);

    act(() => result.current.stackedMode.enter());
    act(() => result.current.toggleQuerySelection({ refId: 'B' } as DataQuery));

    // Stacked mode is single-select: the click drives the active card, not the bulk selection.
    expect(result.current.selectedQuery?.refId).toBe('B');
    expect(result.current.selectedQueryRefIds).toEqual([]);
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

    // Stacked mode is single-select: the click drives the active card, not the bulk selection.
    expect(result.current.selectedTransformation).toEqual(mockTransformation);
    expect(result.current.selectedTransformationIds).toEqual([]);
  });

  it('syncStackedActiveItem mirrors observer-driven activations into the active card selection', () => {
    const reduce: Transformation = {
      registryItem: undefined,
      transformId: 'reduce-0',
      transformConfig: { id: 'reduce', options: {} },
    };
    const { useTransformations } = require('./hooks/useTransformations');
    useTransformations.mockReturnValue([reduce]);

    const { result } = renderWithWrapper(makeMockDataPane());

    const queryItem: StackedEditorItem = { type: QueryEditorType.Query, id: 'A' };
    act(() => result.current.stackedMode.syncActiveItem(queryItem));
    expect(result.current.selectedQuery?.refId).toBe('A');
    expect(result.current.selectedTransformation).toBeNull();

    const transformItem: StackedEditorItem = { type: QueryEditorType.Transformation, id: 'reduce-0' };
    act(() => result.current.stackedMode.syncActiveItem(transformItem));
    expect(result.current.selectedTransformation).toEqual(reduce);
    expect(result.current.selectedQuery).toBeNull();
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

    // Entering multi-select seeds the active card (A); Cmd+click B to build a two-item selection.
    act(() => result.current.setMultiSelectMode(true));
    act(() => result.current.toggleQuerySelection({ refId: 'B' } as DataQuery, { multi: true }));

    expect(result.current.selectedQueryRefIds).toEqual(['A', 'B']);
    expect(result.current.multiSelectMode).toBe(true);

    act(() => result.current.stackedMode.enter());

    // Entering stacked mode exits multi-select and collapses the bulk set to the primary
    // (most-recently-selected) card, which becomes the single active selection.
    expect(result.current.multiSelectMode).toBe(false);
    expect(result.current.selectedQuery?.refId).toBe('B');
    expect(result.current.selectedQueryRefIds).toEqual([]);
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
