import { type TimeRange } from '@grafana/data';

import { type DB, type SQLQuery, type SQLSelectableValue, type ValidationResults } from '../types';

import { type DatasetSelectorProps } from './DatasetSelector';
import { type TableSelectorProps } from './TableSelector';

export const buildMockDB = (): DB => ({
  datasets: jest.fn(() => Promise.resolve(['dataset1', 'dataset2'])),
  tables: jest.fn((_ds: string | undefined) => Promise.resolve(['table1', 'table2'])),
  fields: jest.fn((_query: SQLQuery, _order?: boolean) => Promise.resolve<SQLSelectableValue[]>([])),
  validateQuery: jest.fn((_query: SQLQuery, _range?: TimeRange) =>
    Promise.resolve<ValidationResults>({ query: { refId: '123' }, error: '', isError: false, isValid: true })
  ),
  functions: jest.fn(() => []),
  getEditorLanguageDefinition: jest.fn(() => ({ id: '4567' })),
  toRawSql: (_query: SQLQuery) => '',
});

export function buildMockDatasetSelectorProps(overrides?: Partial<DatasetSelectorProps>): DatasetSelectorProps {
  return {
    db: buildMockDB(),
    dataset: '',
    dialect: 'other',
    onChange: jest.fn(),
    preconfiguredDataset: '',
    ...overrides,
  };
}

export function buildMockTableSelectorProps(overrides?: Partial<TableSelectorProps>): TableSelectorProps {
  return {
    db: buildMockDB(),
    dataset: '',
    table: '',
    onChange: jest.fn(),
    ...overrides,
  };
}
