import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DataSourceInstanceSettings, PluginType } from '@grafana/data';

import { QueryEditorActions } from './QueryEditorContext';

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
  toggleQueryHide: function (refId: string): void {
    throw new Error('Function not implemented.');
  },
};
