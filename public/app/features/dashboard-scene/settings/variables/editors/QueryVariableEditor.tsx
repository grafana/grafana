import React, { FormEvent } from 'react';
import { useAsync } from 'react-use';

import { SelectableValue, DataSourceInstanceSettings, LoadingState } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { getDataSourceSrv, getTemplateSrv } from '@grafana/runtime';
import { QueryVariable, sceneGraph } from '@grafana/scenes';
import { DataSourceRef, VariableRefresh, VariableSort } from '@grafana/schema';
import { Box, Field, Text } from '@grafana/ui';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';
import { getVariableQueryEditor } from 'app/features/variables/editor/getVariableQueryEditor';
import { isLegacyQueryEditor, isQueryEditor } from 'app/features/variables/guard';
import { QueryVariableRefreshSelect } from 'app/features/variables/query/QueryVariableRefreshSelect';
import { QueryVariableSortSelect } from 'app/features/variables/query/QueryVariableSortSelect';

import { SelectionOptionsForm } from '../components/SelectionOptionsForm';
import { VariableLegend } from '../components/VariableLegend';
import { VariableTextAreaField } from '../components/VariableTextAreaField';

interface QueryVariableEditorProps {
  variable: QueryVariable;
  onRunQuery: () => void;
}

export function QueryVariableEditor({ variable, onRunQuery }: QueryVariableEditorProps) {
  const { datasource, regex, sort, refresh, isMulti, includeAll, allValue } = variable.useState();

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

  return (
    <>
      <VariableLegend>Query options</VariableLegend>
      <Field label="Data source" htmlFor="data-source-picker">
        <DataSourcePicker current={datasource} onChange={onDataSourceChange} variables={true} width={30} />
      </Field>

      <QueryEditor variable={variable} onRunQuery={onRunQuery} />

      <VariableTextAreaField
        defaultValue={regex}
        name="Regex"
        description={
          <div>
            Optional, if you want to extract part of a series name or metric node segment.
            <br />
            Named capture groups can be used to separate the display text and value (
            <a
              className="external-link"
              href="https://grafana.com/docs/grafana/latest/variables/filter-variables-with-regex#filter-and-modify-using-named-text-and-value-capture-groups"
              target="__blank"
            >
              see examples
            </a>
            ).
          </div>
        }
        placeholder="/.*-(?<text>.*)-(?<value>.*)-.*/"
        onBlur={onRegExChange}
        testId={selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsRegExInputV2}
        width={52}
      />

      <QueryVariableSortSelect onChange={onSortChange} sort={sort} />

      <QueryVariableRefreshSelect onChange={onRefreshChange} refresh={refresh} />

      <VariableLegend>Selection options</VariableLegend>
      <SelectionOptionsForm
        multi={!!isMulti}
        includeAll={!!includeAll}
        allValue={allValue}
        onMultiChange={onMultiChange}
        onIncludeAllChange={onIncludeAllChange}
        onAllValueChange={onAllValueChange}
      />
    </>
  );
}

interface QueryEditorProps {
  variable: QueryVariable;
  onRunQuery: () => void;
}

const QueryEditor = ({ variable, onRunQuery }: QueryEditorProps) => {
  const { value: range } = sceneGraph.getTimeRange(variable).useState();
  const { datasource: datasourceRef, query: variableQuery } = variable.useState();
  const { value: datasource } = useAsync(async () => await getDataSourceSrv().get(datasourceRef ?? ''));
  const { value: Editor } = useAsync(async () => {
    return datasource ? await getVariableQueryEditor(datasource) : null;
  }, [datasource]);

  const onQueryChange = (query: string) => {
    variable.setState({ query });
  };

  if (!datasource || !Editor) {
    return null;
  }

  let query;
  if (typeof variableQuery === 'string') {
    query = variableQuery || (datasource.variables?.getDefaultQuery?.() ?? '');
  } else if (datasource) {
    query = {
      ...datasource.variables?.getDefaultQuery?.(),
      ...variableQuery,
    };
  }

  if (isLegacyQueryEditor(Editor, datasource)) {
    return (
      <Box marginBottom={2}>
        <Text element={'h4'}>Query</Text>
        <Box marginTop={1}>
          <Editor
            key={datasource.uid}
            datasource={datasource}
            query={query}
            templateSrv={getTemplateSrv()}
            onChange={onQueryChange}
          />
        </Box>
      </Box>
    );
  }

  if (isQueryEditor(Editor, datasource)) {
    return (
      <Box marginBottom={2}>
        <Text element={'h4'}>Query</Text>
        <Box marginTop={1}>
          <Editor
            key={datasource.uid}
            datasource={datasource}
            query={query}
            onChange={onQueryChange}
            onRunQuery={onRunQuery}
            data={{ series: [], state: LoadingState.Done, timeRange: range }}
            range={range}
            onBlur={() => {}}
            history={[]}
          />
        </Box>
      </Box>
    );
  }
  return null;
};
