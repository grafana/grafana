import { FormEvent } from 'react';
import { useAsync } from 'react-use';

import { DataSourceInstanceSettings, getDataSourceRef, SelectableValue, VariableRegexApplyTo } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { getDataSourceSrv } from '@grafana/runtime';
import { QueryVariable, sceneGraph, SceneVariable } from '@grafana/scenes';
import { VariableRefresh, VariableSort } from '@grafana/schema';
import { Field, Stack } from '@grafana/ui';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';
import { QueryEditor } from 'app/features/dashboard-scene/settings/variables/components/QueryEditor';
import { QueryVariableRegexForm } from 'app/features/dashboard-scene/settings/variables/components/QueryVariableRegexForm';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';
import { getVariableQueryEditor } from 'app/features/variables/editor/getVariableQueryEditor';
import { QueryVariableSortSelect } from 'app/features/variables/query/QueryVariableSortSelect';
import { StaticOptionsOrderType, StaticOptionsType } from 'app/features/variables/query/QueryVariableStaticOptions';

import { QueryVariableEditorForm } from '../../components/QueryVariableForm';

import { PaneItem } from './PaneItem';

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

export function getQueryVariableOptions(variable: SceneVariable): OptionsPaneItemDescriptor[] {
  if (!(variable instanceof QueryVariable)) {
    console.warn('getQueryVariableOptions: variable is not a QueryVariable');
    return [];
  }

  return [
    new OptionsPaneItemDescriptor({
      id: `variable-${variable.state.name}-value`,
      render: () => <PaneItem variable={variable} />,
    }),
  ];
}

export function Editor({ variable }: { variable: QueryVariable }) {
  const { datasource: datasourceRef, sort, query, regex, regexApplyTo } = variable.useState();
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

  return (
    <Stack
      direction="column"
      gap={2}
      data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.editor}
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
