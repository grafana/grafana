import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DataSourceInstanceSettings, PluginType } from '@grafana/data';
import { QueryGroupOptions } from 'app/types/query';

import { QueryEditorType } from '../constants';

import { QueryEditorActions, QueryOptionsState } from './QueryEditorContext';

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
  deleteTransformation: jest.fn(),
  duplicateTransformation: jest.fn(),
  toggleTransformationDisabled: jest.fn(),
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

export const mockUIStateBase = {
  selectedQueryDsData: null,
  selectedQueryDsLoading: false,
  showingDatasourceHelp: false,
  toggleDatasourceHelp: jest.fn(),
  cardType: QueryEditorType.Query,
  queryOptions: mockQueryOptionsState,
};
