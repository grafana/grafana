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

// Mock so tests can plug in their own queries via mockGetQueryRunnerFor.
const mockGetQueryRunnerFor = jest.fn();
jest.mock('../../../utils/utils', () => ({
  getQueryRunnerFor: (...args: unknown[]) => mockGetQueryRunnerFor(...args),
}));

function makeMockQueryRunner(queries: DataQuery[] = []) {
  return {
    useState: () => ({ queries, data: undefined }),
  };
}

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
    mockGetQueryRunnerFor.mockReturnValue(null);
    mockUseAlertRulesForPanel.mockReturnValue({
      alertRules: [],
      loading: false,
      isDashboardSaved: true,
    });
  });

  it('clears pending expression when highlighting a query', () => {
    const { usePendingExpression } = require('./hooks/usePendingExpression');
    const { result } = renderWithWrapper(makeMockDataPane());
    const { clearPendingExpression } = usePendingExpression.mock.results[0].value;

    act(() => result.current.setSelectedQuery({ refId: 'A' } as DataQuery));

    expect(clearPendingExpression).toHaveBeenCalled();
  });
});

describe('QueryEditorContextWrapper - alert selection', () => {
  beforeEach(() => {
    mockGetQueryRunnerFor.mockReturnValue(null);
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

  it('clears query/transformation highlight when an alert is highlighted', () => {
    const queryA: DataQuery = { refId: 'A' };
    mockGetQueryRunnerFor.mockReturnValue(makeMockQueryRunner([queryA]));

    const { result } = renderWithWrapper(makeMockDataPane());

    // Establish a non-null query highlight first so the assertion is meaningful.
    act(() => result.current.setSelectedQuery(queryA));
    expect(result.current.selectedQuery).toEqual(queryA);

    act(() => result.current.setSelectedAlert(mockAlert));

    expect(result.current.selectedQuery).toBeNull();
    expect(result.current.selectedTransformation).toBeNull();
    expect(result.current.selectedQueryRefIds).toEqual([]);
    expect(result.current.selectedTransformationIds).toEqual([]);
    expect(result.current.selectedAlert).toEqual(mockAlert);
  });

  it('clears the alert highlight when a query is highlighted', () => {
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

describe('QueryEditorContextWrapper - delete actions', () => {
  beforeEach(() => {
    mockGetQueryRunnerFor.mockReturnValue(null);
    mockUseAlertRulesForPanel.mockReturnValue({
      alertRules: [],
      loading: false,
      isDashboardSaved: true,
    });
  });

  it('deleteQuery falls the highlight back to the remaining query when the deleted refId was highlighted', () => {
    // Simulates the dataPane.deleteQuery side effect (queries array shrinks) so
    // we can observe the highlight rebinding via useSelectedCard's fallback.
    const queryA: DataQuery = { refId: 'A' };
    const queryB: DataQuery = { refId: 'B' };
    let currentQueries: DataQuery[] = [queryA, queryB];
    mockGetQueryRunnerFor.mockReturnValue({
      useState: () => ({ queries: currentQueries, data: undefined }),
    });

    const dataPane = makeMockDataPane();
    (dataPane.deleteQuery as jest.Mock).mockImplementation((refId: string) => {
      currentQueries = currentQueries.filter((q) => q.refId !== refId);
    });

    const { result, rerender } = renderWithBothContexts(dataPane);

    act(() => result.current.ui.setSelectedQuery(queryA));
    expect(result.current.ui.selectedQuery).toEqual(queryA);

    act(() => result.current.actions.deleteQuery('A'));
    rerender();

    // 'A' was removed and was the highlight; the highlight clears, then
    // useSelectedCard falls back to queries[0] which is now 'B'.
    expect(result.current.ui.selectedQuery).toEqual(queryB);
  });

  it('deleteTransformation clears the transformation highlight when the deleted id was highlighted', () => {
    const { useTransformations } = require('./hooks/useTransformations');
    const mockTransformation: Transformation = {
      registryItem: undefined,
      transformId: 'reduce-0',
      transformConfig: { id: 'reduce', options: {} },
    };
    let currentTransformations = [mockTransformation];
    useTransformations.mockImplementation(() => currentTransformations);

    const dataPane = makeMockDataPane();
    (dataPane.deleteTransformation as jest.Mock).mockImplementation((index: number) => {
      currentTransformations = currentTransformations.filter((_, i) => i !== index);
    });

    const { result, rerender } = renderWithBothContexts(dataPane);

    act(() => result.current.ui.setSelectedTransformation(mockTransformation));
    expect(result.current.ui.selectedTransformation).toEqual(mockTransformation);

    act(() => result.current.actions.deleteTransformation('reduce-0'));
    rerender();

    expect(result.current.ui.selectedTransformation).toBeNull();
  });
});
