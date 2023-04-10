import { TimeRange, PluginType } from '@grafana/data';

import { DB, SQLQuery, SQLSelectableValue, ValidationResults } from '../types';

import { DatasetSelectorProps } from './DatasetSelector';
import { SqlQueryEditorProps } from './QueryEditor';

const buildMockDB = (): DB => ({
  datasets: jest.fn(() => Promise.resolve(['dataset1', 'dataset2'])),
  tables: jest.fn((_ds: string | undefined) => Promise.resolve(['table1', 'table2'])),
  fields: jest.fn((_query: SQLQuery, _order?: boolean) => Promise.resolve<SQLSelectableValue[]>([])),
  validateQuery: jest.fn((_query: SQLQuery, _range?: TimeRange) =>
    Promise.resolve<ValidationResults>({ query: { refId: '123' }, error: '', isError: false, isValid: true })
  ),
  dsID: jest.fn(() => 1234),
  getEditorLanguageDefinition: jest.fn(() => ({ id: '4567' })),
  toRawSql: (_query: SQLQuery) => '',
});

// This data is of type `SqlDatasource`
export const buildMockDatasource = (hasDefaultDatabaseConfigured?: boolean) => {
  return {
    id: Infinity,
    type: '',
    name: '',
    uid: '',
    responseParser: { transformMetricFindResponse: jest.fn() },
    interval: '',
    db: buildMockDB(),
    preconfiguredDatabase: hasDefaultDatabaseConfigured ? 'default database' : '',
    getDB: () => buildMockDB(),
    getQueryModel: jest.fn(),
    getResponseParser: jest.fn(),
    interpolateVariable: jest.fn(),
    interpolateVariablesInQueries: jest.fn(),
    filterQuery: jest.fn(),
    applyTemplateVariables: jest.fn(),
    metricFindQuery: jest.fn(),
    templateSrv: {
      getVariables: jest.fn(),
      replace: jest.fn(),
      containsTemplate: jest.fn(),
      updateTimeRange: jest.fn(),
    },
    runSql: jest.fn(),
    runMetaQuery: jest.fn(),
    targetContainsTemplate: jest.fn(),
    query: jest.fn(),
    getRequestHeaders: jest.fn(),
    streamOptionsProvider: jest.fn(),
    getResource: jest.fn(),
    postResource: jest.fn(),
    callHealthCheck: jest.fn(),
    testDatasource: jest.fn(),
    getRef: jest.fn(),
    meta: {
      id: '',
      name: '',
      type: PluginType.panel,
      info: {
        author: { name: '' },
        description: '',
        links: [],
        logos: { large: '', small: '' },
        screenshots: [],
        updated: '',
        version: '',
      },
      module: '',
      baseUrl: '',
    },
  };
};

export function buildSqlQueryEditorProps(overrides?: Partial<SqlQueryEditorProps>): SqlQueryEditorProps {
  return {
    onChange: jest.fn(),
    query: { refId: '123', dataset: 'chosen database' },
    onRunQuery: jest.fn(),
    // @ts-ignore
    datasource: buildMockDatasource(),
    ...overrides,
  };
}

export function buildMockDataSelectorProps(overrides?: Partial<DatasetSelectorProps>): DatasetSelectorProps {
  return {
    dataset: '',
    db: buildMockDB(),
    disableDatasetSelector: false,
    onChange: jest.fn(),
    preconfiguredDataset: '',
    ...overrides,
  };
}
