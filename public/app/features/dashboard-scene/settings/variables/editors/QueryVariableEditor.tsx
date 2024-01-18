import React, { FormEvent, useState } from 'react';
import { useAsync } from 'react-use';

import { SelectableValue } from '@grafana/data';
import { DataSourceInstanceSettings } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { getDataSourceSrv } from '@grafana/runtime';
import { QueryVariable, sceneGraph } from '@grafana/scenes';
import { VariableRefresh, VariableSort } from '@grafana/schema';
import { Box, Field, Text } from '@grafana/ui';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';
import { getVariableQueryEditor } from 'app/features/variables/editor/getVariableQueryEditor';
import { QueryVariableRefreshSelect } from 'app/features/variables/query/QueryVariableRefreshSelect';
import { QueryVariableSortSelect } from 'app/features/variables/query/QueryVariableSortSelect';

import { SelectionOptionsForm } from '../components/SelectionOptionsForm';
import { VariableLegend } from '../components/VariableLegend';
import { VariableTextAreaField } from '../components/VariableTextAreaField';

interface QueryVariableEditorProps {
  variable: QueryVariable;
  onChange: (variable: QueryVariable) => void;
}

export function QueryVariableEditor({ variable }: QueryVariableEditorProps) {
  const { datasource: initialDatasource, regex, sort, refresh, isMulti, includeAll, allValue } = variable.useState();
  const [datasource, setDataSource] = useState(initialDatasource);

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

  return (
    <>
      <VariableLegend>Query options</VariableLegend>
      <Field label="Data source" htmlFor="data-source-picker">
        <DataSourcePicker
          current={datasource}
          onChange={(ds: DataSourceInstanceSettings) => setDataSource(ds)}
          variables={true}
          width={30}
        />
      </Field>

      {/* {this.renderQueryEditor()} */}

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

interface VariableQueryEditorEditorProps {
  variable: QueryVariable;
  onRunQuery: () => void;
}

const renderQueryEditor = ({ variable }: VariableQueryEditorEditorProps) => {
  // const { extended, variable } = this.props;

  // if (!extended || !extended.dataSource || !extended.VariableQueryEditor) {
  //   return null;
  // }

  // const datasource = extended.dataSource;
  // const VariableQueryEditor = extended.VariableQueryEditor;

  // let query = variable.query;

  // if (typeof query === 'string') {
  //   query = query || (datasource.variables?.getDefaultQuery?.() ?? '');
  // } else {
  //   query = {
  //     ...datasource.variables?.getDefaultQuery?.(),
  //     ...variable.query,
  //   };
  // }

  // if (isLegacyQueryEditor(VariableQueryEditor, datasource)) {
  //   return (
  //     <Box marginBottom={2}>
  //       <Text element={'h4'}>Query</Text>
  //       <Box marginTop={1}>
  //         <VariableQueryEditor
  //           key={datasource.uid}
  //           datasource={datasource}
  //           query={query}
  //           templateSrv={getTemplateSrv()}
  //           onChange={this.onLegacyQueryChange}
  //         />
  //       </Box>
  //     </Box>
  //   );
  // }

  const range = sceneGraph.getTimeRange(variable);
  const { datasource } = variable.useState();

  useAsync(async () => {
    const dataSource = await getDataSourceSrv().get(datasource ?? '');
    const DataSourceEditor = getVariableQueryEditor(dataSource);
    setQueryEditor(DataSourceEditor);
  });

  if (isQueryEditor(VariableQueryEditor, datasource)) {
    return (
      <Box marginBottom={2}>
        <Text element={'h4'}>Query</Text>
        <Box marginTop={1}>
          <VariableQueryEditor
            key={datasource.uid}
            datasource={datasource}
            query={query}
            onChange={this.onQueryChange}
            onRunQuery={() => {}}
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
