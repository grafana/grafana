import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactElement } from 'react';

import { DataSourceInstanceSettings, getDefaultTimeRange, LoadingState, PluginType } from '@grafana/data';
import { VizPanel } from '@grafana/scenes';
import { DataQuery } from '@grafana/schema';
import { ExpressionQuery } from 'app/features/expressions/types';
import { QueryGroupOptions } from 'app/types/query';

import {
  ActiveContext,
  AlertingState,
  DatasourceState,
  INITIAL_ACTIVE_CONTEXT,
  PanelState,
  QueryEditorActions,
  QueryEditorProvider,
  QueryEditorUIState,
  QueryOptionsState,
  QueryRunnerState,
} from './QueryEditorContext';
import { Transformation } from './types';

export function setup(jsx: React.ReactElement) {
  return {
    user: userEvent.setup(),
    ...render(jsx),
  };
}

export const ds1SettingsMock: DataSourceInstanceSettings = {
  id: 1,
  uid: 'test',
  name: 'Test DS',
  type: 'test',
  meta: {
    id: 'test',
    name: 'Test',
    type: PluginType.datasource,
    info: {
      author: { name: '' },
      description: '',
      links: [],
      logos: { small: 'test-logo.png', large: '' },
      screenshots: [],
      updated: '',
      version: '',
    },
    module: '',
    baseUrl: '',
  },
  access: 'proxy',
  readOnly: false,
  jsonData: {},
};

export const mockActions: QueryEditorActions = {
  updateQueries: jest.fn(),
  updateSelectedQuery: jest.fn(),
  addQuery: jest.fn(),
  deleteQuery: jest.fn(),
  duplicateQuery: jest.fn(),
  runQueries: jest.fn(),
  changeDataSource: jest.fn(),
  toggleQueryHide: jest.fn(),
  onQueryOptionsChange: jest.fn(),
  addTransformation: jest.fn(),
  deleteTransformation: jest.fn(),
  toggleTransformationDisabled: jest.fn(),
  updateTransformation: jest.fn(),
  reorderTransformations: jest.fn(),
};

export const mockOptions: QueryGroupOptions = {
  queries: [],
  dataSource: { type: undefined, uid: undefined },
  maxDataPoints: undefined,
  minInterval: undefined,
  timeRange: {
    from: undefined,
    shift: undefined,
    hide: undefined,
  },
};

export const mockQueryOptionsState: QueryOptionsState = {
  options: mockOptions,
  isQueryOptionsOpen: false,
  openSidebar: jest.fn(),
  closeSidebar: jest.fn(),
  focusedField: null,
};

export const mockTransformToggles = {
  showHelp: false,
  toggleHelp: jest.fn(),
  showDebug: false,
  toggleDebug: jest.fn(),
};

export const mockUIStateBase = {
  activeContext: INITIAL_ACTIVE_CONTEXT as ActiveContext,
  setActiveContext: jest.fn(),
  selectedExpression: null,
  selectedQueryDsData: null,
  selectedQueryDsLoading: false,
  showingDatasourceHelp: false,
  toggleDatasourceHelp: jest.fn(),
  queryOptions: mockQueryOptionsState,
  finalizeExpressionPicker: jest.fn(),
  finalizeTransformationPicker: jest.fn(),
  selectedItems: [],
  setSelectedItems: jest.fn(),
};

interface CreateQueryEditorProviderOptions {
  queries?: DataQuery[];
  transformations?: Transformation[];
  selectedQuery?: DataQuery | null;
  selectedExpression?: ExpressionQuery | null;
  selectedTransformation?: Transformation | null;
  uiStateOverrides?: Partial<QueryEditorUIState>;
  actionsOverrides?: Partial<QueryEditorActions>;
  dsState?: Partial<DatasourceState>;
  qrState?: Partial<QueryRunnerState>;
  panelState?: Partial<PanelState>;
  alertingState?: Partial<AlertingState>;
}

/**
 * Test helper to create a QueryEditorProvider with sensible defaults.
 * Pass only the props you need to customize.
 *
 * @example
 * const { user, ...result } = renderWithQueryEditorProvider(
 *   <MyComponent />,
 *   { queries: [mockQuery], selectedQuery: mockQuery }
 * );
 */
export function renderWithQueryEditorProvider(children: ReactElement, options: CreateQueryEditorProviderOptions = {}) {
  const {
    queries = [],
    transformations = [],
    selectedQuery = null,
    selectedExpression = null,
    selectedTransformation = null,
    uiStateOverrides = {},
    actionsOverrides = {},
    dsState = {},
    qrState = {},
    panelState = {},
    alertingState = {},
  } = options;

  const defaultDsState: DatasourceState = {
    datasource: undefined,
    dsSettings: undefined,
    dsError: undefined,
    ...dsState,
  };

  const defaultQrState: QueryRunnerState = {
    queries,
    data: {
      state: LoadingState.Done,
      series: [],
      timeRange: getDefaultTimeRange(),
    },
    isLoading: false,
    queryError: undefined,
    ...qrState,
  };

  const defaultPanelState: PanelState = {
    panel: new VizPanel({ key: 'panel-1' }),
    transformations,
    ...panelState,
  };

  const defaultUiState: QueryEditorUIState = {
    activeContext: INITIAL_ACTIVE_CONTEXT,
    setActiveContext: jest.fn(),
    selectedQuery,
    selectedExpression,
    selectedTransformation,
    selectedAlert: null,
    selectedItems: [],
    setSelectedItems: jest.fn(),
    queryOptions: mockQueryOptionsState,
    selectedQueryDsData: null,
    selectedQueryDsLoading: false,
    showingDatasourceHelp: false,
    toggleDatasourceHelp: jest.fn(),
    transformToggles: mockTransformToggles,
    finalizeExpressionPicker: jest.fn(),
    finalizeTransformationPicker: jest.fn(),
    ...uiStateOverrides,
  };

  const defaultActions: QueryEditorActions = {
    ...mockActions,
    ...actionsOverrides,
  };

  const defaultAlertingState: AlertingState = {
    alertRules: [],
    loading: false,
    isDashboardSaved: true,
    ...alertingState,
  };

  return {
    user: userEvent.setup({ pointerEventsCheck: 0 }),
    ...render(
      <QueryEditorProvider
        dsState={defaultDsState}
        qrState={defaultQrState}
        panelState={defaultPanelState}
        uiState={defaultUiState}
        actions={defaultActions}
        alertingState={defaultAlertingState}
      >
        {children}
      </QueryEditorProvider>
    ),
  };
}
