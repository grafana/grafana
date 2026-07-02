import { type FormEvent } from 'react';
import { useAsync } from 'react-use';

import {
  type DataSourceInstanceSettings,
  getDataSourceRef,
  type SelectableValue,
  type VariableRegexApplyTo,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { getDataSourceSrv } from '@grafana/runtime';
import { type QueryVariable, sceneGraph } from '@grafana/scenes';
import { type VariableRefresh, type VariableSort } from '@grafana/schema';
import { Field, Stack } from '@grafana/ui';
import { QueryEditor } from 'app/features/dashboard-scene/settings/variables/components/QueryEditor';
import { QueryVariableRegexForm } from 'app/features/dashboard-scene/settings/variables/components/QueryVariableRegexForm';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';
import { getVariableQueryEditor } from 'app/features/variables/editor/getVariableQueryEditor';
import { QueryVariableRefreshSelect } from 'app/features/variables/query/QueryVariableRefreshSelect';
import { QueryVariableSortSelect } from 'app/features/variables/query/QueryVariableSortSelect';
import {
  QueryVariableStaticOptions,
  type StaticOptionsOrderType,
  type StaticOptionsType,
} from 'app/features/variables/query/QueryVariableStaticOptions';

import { QueryVariableEditorForm } from '../../components/QueryVariableForm';
import { VariableValuesPreview } from '../../components/VariableValuesPreview';
import { hasVariableOptions } from '../../utils';

interface QueryVariableEditorProps {
  variable: QueryVariable;
  onRunQuery: () => void;
}
type VariableQueryType = QueryVariable['state']['query'];

export function QueryVariableEditor({ variable, onRunQuery }: QueryVariableEditorProps) {
  const {
    datasource,
    regex,
    regexApplyTo,
    sort,
    refresh,
    isMulti,
    includeAll,
    allValue,
    query,
    allowCustomValue,
    options,
    staticOptions,
    staticOptionsOrder,
  } = variable.useState();
  const { value: timeRange } = sceneGraph.getTimeRange(variable).useState();

  const onRegExChange = (event: React.FormEvent<HTMLTextAreaElement>) => {
    variable.setState({ regex: event.currentTarget.value });
  };
  const onRegexApplyToChange = (event: VariableRegexApplyTo) => {
    variable.setState({ regexApplyTo: event });
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
  const onAllowCustomValueChange = (event: FormEvent<HTMLInputElement>) => {
    variable.setState({ allowCustomValue: event.currentTarget.checked });
  };
  const onDataSourceChange = (dsInstanceSettings: DataSourceInstanceSettings, preserveQuery = false) => {
    const datasource = getDataSourceRef(dsInstanceSettings);

    if (!preserveQuery && (variable.state.datasource?.type || '') !== datasource.type) {
      variable.setState({ datasource, query: '', definition: '' });
      return;
    }

    variable.setState({ datasource });
  };
  const onQueryChange = (query: VariableQueryType) => {
    variable.setState({ query, definition: getQueryDef(query) });
    onRunQuery();
  };

  const onStaticOptionsChange = (staticOptions: StaticOptionsType) => {
    onRunQuery();
    variable.setState({ staticOptions });
  };

  const onStaticOptionsOrderChange = (staticOptionsOrder: StaticOptionsOrderType) => {
    onRunQuery();
    variable.setState({ staticOptionsOrder });
  };

  return (
    <QueryVariableEditorForm
      datasource={datasource ?? undefined}
      onDataSourceChange={onDataSourceChange}
      query={query}
      onQueryChange={onQueryChange}
      onLegacyQueryChange={onQueryChange}
      timeRange={timeRange}
      regex={regex}
      regexApplyTo={regexApplyTo}
      onRegExChange={onRegExChange}
      onRegexApplyToChange={onRegexApplyToChange}
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
      allowCustomValue={allowCustomValue}
      onAllowCustomValueChange={onAllowCustomValueChange}
      staticOptions={staticOptions}
      staticOptionsOrder={staticOptionsOrder}
      onStaticOptionsChange={onStaticOptionsChange}
      onStaticOptionsOrderChange={onStaticOptionsOrderChange}
      options={options}
    />
  );
}

interface EditorProps {
  variable: QueryVariable;
  hideRefresh?: boolean;
  hideStaticOptions?: boolean;
  hidePreview?: boolean;
}

export function Editor({ variable, hideRefresh, hideStaticOptions, hidePreview }: EditorProps) {
  const {
    datasource: datasourceRef,
    sort,
    refresh,
    query,
    regex,
    regexApplyTo,
    options,
    staticOptions,
    staticOptionsOrder,
  } = variable.useState();
  const { value: timeRange } = sceneGraph.getTimeRange(variable).useState();
  const { value: dsConfig } = useAsync(async () => {
    const datasource = await getDataSourceSrv().get(datasourceRef ?? '');
    const VariableQueryEditor = await getVariableQueryEditor(datasource);
    const defaultQuery = datasource?.variables?.getDefaultQuery?.();

    if (!query && defaultQuery) {
      const newQuery =
        typeof defaultQuery === 'string' ? defaultQuery : { ...defaultQuery, refId: defaultQuery.refId ?? 'A' };
      onQueryChange(newQuery);
    }

    return { datasource, VariableQueryEditor };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasourceRef]);

  const { datasource: selectedDatasource, VariableQueryEditor } = dsConfig ?? {};

  const onDataSourceChange = (dsInstanceSettings: DataSourceInstanceSettings) => {
    const datasource = getDataSourceRef(dsInstanceSettings);

    if ((variable.state.datasource?.type || '') !== datasource.type) {
      variable.setState({ datasource, query: '', definition: '' });
      return;
    }

    variable.setState({ datasource });
  };

  const onQueryChange = (query: VariableQueryType) => {
    variable.setState({ query, definition: getQueryDef(query) });
  };
  const onRegExChange = (event: React.FormEvent<HTMLTextAreaElement>) => {
    variable.setState({ regex: event.currentTarget.value });
  };
  const onRegexApplyToChange = (event: VariableRegexApplyTo) => {
    variable.setState({ regexApplyTo: event });
  };
  const onSortChange = (sort: SelectableValue<VariableSort>) => {
    variable.setState({ sort: sort.value });
  };
  const onRefreshChange = (refresh: VariableRefresh) => {
    variable.setState({ refresh: refresh });
  };
  const onStaticOptionsChange = (staticOptions: StaticOptionsType) => {
    variable.setState({ staticOptions });
  };
  const onStaticOptionsOrderChange = (staticOptionsOrder: StaticOptionsOrderType) => {
    variable.setState({ staticOptionsOrder });
  };

  const isHasVariableOptions = hasVariableOptions(variable);

  return (
    <Stack
      data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.editor}
      direction="column"
      gap={1}
    >
      <Field
        label={t('dashboard-scene.query-variable-editor-form.label-target-data-source', 'Target data source')}
        htmlFor="data-source-picker"
        noMargin
      >
        <DataSourcePicker current={datasourceRef} onChange={onDataSourceChange} variables={true} width={30} />
      </Field>

      {selectedDatasource && VariableQueryEditor && (
        <QueryEditor
          onQueryChange={onQueryChange}
          onLegacyQueryChange={onQueryChange}
          datasource={selectedDatasource}
          query={query}
          VariableQueryEditor={VariableQueryEditor}
          timeRange={timeRange}
        />
      )}

      <QueryVariableRegexForm
        regex={regex}
        regexApplyTo={regexApplyTo}
        onRegExChange={onRegExChange}
        onRegexApplyToChange={onRegexApplyToChange}
      />

      <QueryVariableSortSelect
        testId={selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsSortSelectV2}
        onChange={onSortChange}
        sort={sort}
      />

      {!hideRefresh && (
        <QueryVariableRefreshSelect
          testId={selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsRefreshSelectV2}
          onChange={onRefreshChange}
          refresh={refresh}
        />
      )}

      {!hideStaticOptions && (
        <QueryVariableStaticOptions
          options={options}
          staticOptions={staticOptions}
          staticOptionsOrder={staticOptionsOrder}
          onStaticOptionsChange={onStaticOptionsChange}
          onStaticOptionsOrderChange={onStaticOptionsOrderChange}
        />
      )}

      {!hidePreview && isHasVariableOptions && (
        <VariableValuesPreview options={options} staticOptions={staticOptions ?? []} />
      )}
    </Stack>
  );
}

function getQueryDef(query: VariableQueryType) {
  if (typeof query === 'string') {
    return query;
  } else if (query.hasOwnProperty('query') && typeof query.query === 'string') {
    return query.query;
  } else {
    return '';
  }
}
