import { useState, FormEvent } from 'react';

import { SelectableValue, DataSourceInstanceSettings, getDataSourceRef } from '@grafana/data';
import { QueryVariable, sceneGraph, SceneVariable } from '@grafana/scenes';
import { VariableRefresh, VariableSort } from '@grafana/schema';

import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';
import { QueryEditor } from 'app/features/dashboard-scene/settings/variables/components/QueryEditor';

import { QueryVariableEditorForm } from '../components/QueryVariableForm';
import { Box, Button, Field, Modal, TextLink } from '@grafana/ui';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';
import { t, Trans } from 'app/core/internationalization';
import { useAsync } from 'react-use';
import { getDataSourceSrv } from '@grafana/runtime';
import { getVariableQueryEditor } from 'app/features/variables/editor/getVariableQueryEditor';
import { VariableTextAreaField } from '../components/VariableTextAreaField';
import { QueryVariableSortSelect } from 'app/features/variables/query/QueryVariableSortSelect';
import { selectors } from '@grafana/e2e-selectors';
import { QueryVariableRefreshSelect } from 'app/features/variables/query/QueryVariableRefreshSelect';
import { VariableValuesPreview } from '../components/VariableValuesPreview';
import { hasVariableOptions } from '../utils';

interface QueryVariableEditorProps {
  variable: QueryVariable;
  onRunQuery: () => void;
}
type VariableQueryType = QueryVariable['state']['query'];

export function QueryVariableEditor({ variable, onRunQuery }: QueryVariableEditorProps) {
  const { datasource, regex, sort, refresh, isMulti, includeAll, allValue, query, allowCustomValue } =
    variable.useState();
  const { value: timeRange } = sceneGraph.getTimeRange(variable).useState();

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
  const onAllowCustomValueChange = (event: FormEvent<HTMLInputElement>) => {
    variable.setState({ allowCustomValue: event.currentTarget.checked });
  };
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
    onRunQuery();
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
      allowCustomValue={allowCustomValue}
      onAllowCustomValueChange={onAllowCustomValueChange}
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
      title: t('dashboard-scene.query-variable-form.label-editor', 'Query Editor'),
      render: () => <ModalEditor variable={variable} />,
    }),
  ];
}

function ModalEditor({ variable }: { variable: QueryVariable }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Box display={'flex'} direction={'column'} paddingBottom={1}>
        <Button
          tooltip={t(
            'dashboard.edit-pane.variable.open-editor-tooltip',
            'For more variable options open variable editor'
          )}
          onClick={() => setIsOpen(true)}
          size="sm"
          fullWidth
        >
          <Trans i18nKey="dashboard.edit-pane.variable.open-editor">Open variable editor</Trans>
        </Button>
      </Box>
      <Modal title="Query Variable" isOpen={isOpen}>
        <Editor variable={variable} onRunQuery={() => { }} />
        <Modal.ButtonRow>
          <Button variant="secondary" fill="outline" onClick={() => setIsOpen(false)}>
            Done
          </Button>
        </Modal.ButtonRow>
      </Modal>
    </>
  );
}

function Editor({ variable, onRunQuery }: { variable: QueryVariable, onRunQuery: () => void }) {
  const { datasource: datasourceRef, sort, refresh, query, regex } = variable.useState();
  const { value: timeRange } = sceneGraph.getTimeRange(variable).useState();
  const { value: dsConfig } = useAsync(async () => {
    const datasource = await getDataSourceSrv().get(datasourceRef ?? '');
    const VariableQueryEditor = await getVariableQueryEditor(datasource);
    const defaultQuery = datasource?.variables?.getDefaultQuery?.();

    if (!query && defaultQuery) {
      const query =
        typeof defaultQuery === 'string' ? defaultQuery : { ...defaultQuery, refId: defaultQuery.refId ?? 'A' };
      onQueryChange(query);
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
    onRunQuery();
  };

  const onRegExChange = (event: React.FormEvent<HTMLTextAreaElement>) => {
    variable.setState({ regex: event.currentTarget.value });
  };
  
  const onSortChange = (sort: SelectableValue<VariableSort>) => {
    variable.setState({ sort: sort.value });
  };
  const onRefreshChange = (refresh: VariableRefresh) => {
    variable.setState({ refresh: refresh });
  };

  const isHasVariableOptions = hasVariableOptions(variable);
  
  return (
    <>
      <Field
        label={t('dashboard-scene.query-variable-editor-form.label-data-source', 'Data source')}
        htmlFor="data-source-picker"
      >
        <DataSourcePicker current={selectedDatasource} onChange={onDataSourceChange} variables={true} width={30} />
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

      <VariableTextAreaField
        defaultValue={regex ?? ''}
        name="Regex"
        description={
          <div>
            <Trans i18nKey="dashboard-scene.query-variable-editor-form.description-optional">
              Optional, if you want to extract part of a series name or metric node segment.
            </Trans>
            <br />
            <Trans i18nKey="dashboard-scene.query-variable-editor-form.description-examples">
              Named capture groups can be used to separate the display text and value (
              <TextLink
                href="https://grafana.com/docs/grafana/latest/variables/filter-variables-with-regex#filter-and-modify-using-named-text-and-value-capture-groups"
                external
              >
                see examples
              </TextLink>
              ).
            </Trans>
          </div>
        }
        // eslint-disable-next-line @grafana/no-untranslated-strings
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

      {isHasVariableOptions && <VariableValuesPreview options={variable.getOptionsForSelect(false)} />}
    </>
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
