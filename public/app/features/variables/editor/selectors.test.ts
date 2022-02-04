import { getAdhocVariableState, getDatasourceVariableState, getQueryVariableState } from './selectors';
import {
  AdHocVariableEditorState,
  DataSourceVariableEditorState,
  initialVariableEditorState,
  QueryVariableEditorState,
} from './reducer';
import { LegacyVariableQueryEditor } from './LegacyVariableQueryEditor';
import { DataSourceApi } from '@grafana/data';

const adhocExtended: AdHocVariableEditorState = {
  dataSources: [
    { text: 'Prometheus', value: null }, // default datasource
    { text: 'Loki', value: { type: 'loki-ds', uid: 'abc' } },
  ],
};

const datasourceExtended: DataSourceVariableEditorState = {
  dataSourceTypes: [
    { text: 'Prometheus', value: 'ds-prom' },
    { text: 'Loki', value: 'ds-loki' },
  ],
};

const queryExtended: QueryVariableEditorState = {
  VariableQueryEditor: LegacyVariableQueryEditor,
  dataSource: {} as unknown as DataSourceApi,
};

const adhocVariableState = {
  ...initialVariableEditorState,
  extended: adhocExtended,
};

const datasourceVariableState = {
  ...initialVariableEditorState,
  extended: datasourceExtended,
};

const queryVariableState = {
  ...initialVariableEditorState,
  extended: queryExtended,
};

describe('getAdhocVariableState', () => {
  it('returns the extended properties for adhoc variable state', () => {
    expect(getAdhocVariableState(adhocVariableState)).toBe(adhocExtended);
  });

  it('returns null for datasource variable state', () => {
    expect(getAdhocVariableState(datasourceVariableState)).toBeNull();
  });

  it('returns null for query variable state', () => {
    expect(getAdhocVariableState(queryVariableState)).toBeNull();
  });
});

describe('getDatasourceVariableState', () => {
  it('returns the extended properties for datasource variable state', () => {
    expect(getDatasourceVariableState(datasourceVariableState)).toBe(datasourceExtended);
  });

  it('returns null for adhoc variable state', () => {
    expect(getDatasourceVariableState(adhocVariableState)).toBeNull();
  });

  it('returns null for query variable state', () => {
    expect(getDatasourceVariableState(queryVariableState)).toBeNull();
  });
});

describe('getQueryVariableState', () => {
  it('returns the extended properties for query variable state', () => {
    expect(getQueryVariableState(queryVariableState)).toBe(queryExtended);
  });

  it('returns null for adhoc variable state', () => {
    expect(getQueryVariableState(adhocVariableState)).toBeNull();
  });

  it('returns null for datasource variable state', () => {
    expect(getQueryVariableState(datasourceVariableState)).toBeNull();
  });
});
