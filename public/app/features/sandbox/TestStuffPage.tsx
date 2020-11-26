import { ApplyFieldOverrideOptions, DataQuery, DataSourceSelectItem, DataTransformerConfig } from '@grafana/data';
import { config } from 'app/core/config';
import React, { FC, useState } from 'react';
import { QueriesTab } from '../query/components/QueriesTab';
import { PanelQueryRunner } from '../query/state/PanelQueryRunner';

interface State {
  queries: DataQuery[];
  queryRunner: PanelQueryRunner;
  dataSourceName: string | null;
}

export const TestStuffPage: FC = () => {
  const [state, setState] = useState<State>(getDefaultState());

  const onDataSourceChange = (ds: DataSourceSelectItem, queries: DataQuery[]) => {
    setState({
      ...state,
      dataSourceName: ds.value,
      queries: queries,
    });
  };

  const onRunQueries = () => {};

  const onQueriesChange = (queries: DataQuery[]) => {
    setState({
      ...state,
      queries: queries,
    });
  };

  return (
    <div style={{ padding: '50px', height: '100%', flexGrow: 1 }} className="page-scrollbar-wrapper">
      <h2>Hello</h2>

      <QueriesTab
        dataSourceName={state.dataSourceName}
        queryRunner={state.queryRunner}
        queries={state.queries}
        onDataSourceChange={onDataSourceChange}
        onRunQueries={onRunQueries}
        onQueriesChange={onQueriesChange}
      />
    </div>
  );
};

export function getDefaultState(): State {
  const options: ApplyFieldOverrideOptions = {
    fieldConfig: {
      defaults: {},
      overrides: [],
    },
    replaceVariables: (v: string) => v,
    getDataSourceSettingsByUid: (uid: string) => undefined,
    theme: config.theme,
  };

  const dataConfig = {
    getTransformations: () => [] as DataTransformerConfig[],
    getFieldOverrideOptions: () => options,
  };

  return {
    queries: [],
    dataSourceName: 'gdev-testdata',
    queryRunner: new PanelQueryRunner(dataConfig),
  };
}

export default TestStuffPage;
