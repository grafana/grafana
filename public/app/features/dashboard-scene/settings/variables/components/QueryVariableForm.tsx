import React, { FormEvent } from 'react';

import { DataSourceApi, DataSourceInstanceSettings, SelectableValue, TimeRange } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { QueryVariable } from '@grafana/scenes';
import { VariableRefresh, VariableSort } from '@grafana/schema';
import { Field } from '@grafana/ui';
import { QueryEditor } from 'app/features/dashboard-scene/settings/variables/components/QueryEditor';
import { SelectionOptionsForm } from 'app/features/dashboard-scene/settings/variables/components/SelectionOptionsForm';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';
import { QueryVariableRefreshSelect } from 'app/features/variables/query/QueryVariableRefreshSelect';
import { QueryVariableSortSelect } from 'app/features/variables/query/QueryVariableSortSelect';
import { VariableQueryEditorType } from 'app/features/variables/types';

import { VariableLegend } from './VariableLegend';
import { VariableTextAreaField } from './VariableTextAreaField';

type VariableQueryType = QueryVariable['state']['query'];

interface QueryVariableEditorFormProps {
  datasource: DataSourceApi | undefined;
  onDataSourceChange: (dsSettings: DataSourceInstanceSettings) => void;
  query: VariableQueryType;
  onQueryChange: (query: VariableQueryType) => void;
  onLegacyQueryChange: (query: VariableQueryType, definition: string) => void;
  VariableQueryEditor: VariableQueryEditorType | undefined;
  timeRange: TimeRange;
  regex: string | null;
  onRegExChange: (event: FormEvent<HTMLTextAreaElement>) => void;
  sort: VariableSort;
  onSortChange: (option: SelectableValue<VariableSort>) => void;
  refresh: VariableRefresh;
  onRefreshChange: (option: VariableRefresh) => void;
  isMulti: boolean;
  onMultiChange: (event: FormEvent<HTMLInputElement>) => void;
  includeAll: boolean;
  onIncludeAllChange: (event: FormEvent<HTMLInputElement>) => void;
  allValue: string;
  onAllValueChange: (event: FormEvent<HTMLInputElement>) => void;
}

export function QueryVariableEditorForm({
  datasource,
  onDataSourceChange,
  query,
  onQueryChange,
  onLegacyQueryChange,
  VariableQueryEditor,
  timeRange,
  regex,
  onRegExChange,
  sort,
  onSortChange,
  refresh,
  onRefreshChange,
  isMulti,
  onMultiChange,
  includeAll,
  onIncludeAllChange,
  allValue,
  onAllValueChange,
}: QueryVariableEditorFormProps) {
  return (
    <>
      <VariableLegend>Query options</VariableLegend>
      <Field label="Data source" htmlFor="data-source-picker">
        <DataSourcePicker current={datasource} onChange={onDataSourceChange} variables={true} width={30} />
      </Field>

      {datasource && VariableQueryEditor && (
        <QueryEditor
          onQueryChange={onQueryChange}
          onLegacyQueryChange={onLegacyQueryChange}
          datasource={datasource}
          query={query}
          VariableQueryEditor={VariableQueryEditor}
          timeRange={timeRange}
        />
      )}

      <VariableTextAreaField
        defaultValue={regex ?? ''}
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

      <QueryVariableSortSelect
        testId={selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsSortSelectV2}
        onChange={onSortChange}
        sort={sort}
      />

      <QueryVariableRefreshSelect
        testId={selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsRefreshSelectV2}
        onChange={onRefreshChange}
        refresh={refresh}
      />

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
