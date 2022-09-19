import { DataSourceApi } from '@grafana/data';

import { LegacyVariableQueryEditor } from './LegacyVariableQueryEditor';
import {
  AdHocVariableEditorState,
  DataSourceVariableEditorState,
  initialVariableEditorState,
  QueryVariableEditorState,
} from './reducer';
import {
  getAdhocVariableEditorState,
  getDatasourceVariableEditorState,
  getQueryVariableEditorState,
} from './selectors';

const adhocExtended: AdHocVariableEditorState = {
  infoText: 'infoText',
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

describe('getAdhocVariableEditorState', () => {
  it('returns the extended properties for adhoc variable state', () => {
    expect(getAdhocVariableEditorState(adhocVariableState)).toBe(adhocExtended);
  });

  it('returns null for datasource variable state', () => {
    expect(getAdhocVariableEditorState(datasourceVariableState)).toBeNull();
  });

  it('returns null for query variable state', () => {
    expect(getAdhocVariableEditorState(queryVariableState)).toBeNull();
  });
});

describe('getDatasourceVariableEditorState', () => {
  it('returns the extended properties for datasource variable state', () => {
    expect(getDatasourceVariableEditorState(datasourceVariableState)).toBe(datasourceExtended);
  });

  it('returns null for adhoc variable state', () => {
    expect(getDatasourceVariableEditorState(adhocVariableState)).toBeNull();
  });

  it('returns null for query variable state', () => {
    expect(getDatasourceVariableEditorState(queryVariableState)).toBeNull();
  });
});

describe('getQueryVariableEditorState', () => {
  it('returns the extended properties for query variable state', () => {
    expect(getQueryVariableEditorState(queryVariableState)).toBe(queryExtended);
  });

  it('returns null for adhoc variable state', () => {
    expect(getQueryVariableEditorState(adhocVariableState)).toBeNull();
  });

  it('returns null for datasource variable state', () => {
    expect(getQueryVariableEditorState(datasourceVariableState)).toBeNull();
  });
});
