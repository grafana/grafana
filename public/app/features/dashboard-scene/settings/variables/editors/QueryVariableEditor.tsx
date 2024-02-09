import React, { FormEvent } from 'react';
import { useAsync } from 'react-use';

import { SelectableValue, DataSourceInstanceSettings } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { QueryVariable, sceneGraph } from '@grafana/scenes';
import { DataSourceRef, VariableRefresh, VariableSort } from '@grafana/schema';
import { getVariableQueryEditor } from 'app/features/variables/editor/getVariableQueryEditor';

import { QueryVariableEditorForm } from '../components/QueryVariableForm';

interface QueryVariableEditorProps {
  variable: QueryVariable;
  onRunQuery: () => void;
}
type VariableQueryType = QueryVariable['state']['query'];

export function QueryVariableEditor({ variable, onRunQuery }: QueryVariableEditorProps) {
  const { datasource: datasourceRef, regex, sort, refresh, isMulti, includeAll, allValue, query } = variable.useState();
  const { value: timeRange } = sceneGraph.getTimeRange(variable).useState();

  const { value: dsConfig } = useAsync(async () => {
    const datasource = await getDataSourceSrv().get(datasourceRef ?? '');
    const VariableQueryEditor = await getVariableQueryEditor(datasource);

    return { datasource, VariableQueryEditor };
  }, [datasourceRef]);
  const { datasource, VariableQueryEditor } = dsConfig ?? {};

  const onRegExChange = (event: React.FormEvent<HTMLTextAreaElement>) => {
    variable.setState({ regex: event.currentTarget.value });
  };
  const onSortChange = (sort: SelectableValue<VariableSort>) => {
    variable.setState({ sort: sort.value });
  };
  const onRefreshChange = (refresh: VariableRefresh) => {
    variable.setState({ refresh: refresh });
  };
  const onMultiChange = (event: FormEvent<HTMLInputElement>) => {
    variable.setState({ isMulti: event.currentTarget.checked });
  };
  const onIncludeAllChange = (event: FormEvent<HTMLInputElement>) => {
    variable.setState({ includeAll: event.currentTarget.checked });
  };
  const onAllValueChange = (event: FormEvent<HTMLInputElement>) => {
    variable.setState({ allValue: event.currentTarget.value });
  };
  const onDataSourceChange = (dsInstanceSettings: DataSourceInstanceSettings) => {
    const datasource: DataSourceRef = { uid: dsInstanceSettings.uid, type: dsInstanceSettings.type };
    variable.setState({ datasource });
  };
  const onQueryChange = (query: VariableQueryType) => {
    variable.setState({ query });
    onRunQuery();
  };

  return (
    <QueryVariableEditorForm
      datasource={datasource}
      onDataSourceChange={onDataSourceChange}
      query={query}
      onQueryChange={onQueryChange}
      onLegacyQueryChange={onQueryChange}
      VariableQueryEditor={VariableQueryEditor}
      timeRange={timeRange}
      regex={regex}
      onRegExChange={onRegExChange}
      sort={sort}
      onSortChange={onSortChange}
      refresh={refresh}
      onRefreshChange={onRefreshChange}
      isMulti={!!isMulti}
      onMultiChange={onMultiChange}
      includeAll={!!includeAll}
      onIncludeAllChange={onIncludeAllChange}
      allValue={allValue ?? ''}
      onAllValueChange={onAllValueChange}
    />
  );
}
