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
