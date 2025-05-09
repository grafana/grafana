import { useState, FormEvent } from 'react';
import { useAsync } from 'react-use';

import { SelectableValue, DataSourceInstanceSettings, getDataSourceRef } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { getDataSourceSrv } from '@grafana/runtime';
import { QueryVariable, sceneGraph, SceneVariable } from '@grafana/scenes';
import { VariableRefresh, VariableSort } from '@grafana/schema';
import { Box, Button, Field, Modal, TextLink } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';
import { QueryEditor } from 'app/features/dashboard-scene/settings/variables/components/QueryEditor';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';
import { getVariableQueryEditor } from 'app/features/variables/editor/getVariableQueryEditor';
import { QueryVariableRefreshSelect } from 'app/features/variables/query/QueryVariableRefreshSelect';
import { QueryVariableSortSelect } from 'app/features/variables/query/QueryVariableSortSelect';

import { QueryVariableEditorForm } from '../components/QueryVariableForm';
import { VariableTextAreaField } from '../components/VariableTextAreaField';
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

export function ModalEditor({ variable }: { variable: QueryVariable }) {
  const [isOpen, setIsOpen] = useState(false);

  const onRunQuery = () => {
    variable.refreshOptions();
  };

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
      <Modal
        title={t('dashboard.edit-pane.variable.query-options.modal-title', 'Query Variable')}
        isOpen={isOpen}
        onDismiss={() => setIsOpen(false)}
      >
        <Editor variable={variable} />
        <Modal.ButtonRow>
          <Button variant="primary" fill="outline" onClick={onRunQuery}>
            <Trans i18nKey="dashboard.edit-pane.variable.query-options.preview">Preview</Trans>
          </Button>
          <Button variant="secondary" fill="outline" onClick={() => setIsOpen(false)}>
            <Trans i18nKey="dashboard.edit-pane.variable.query-options.close">Close</Trans>
          </Button>
        </Modal.ButtonRow>
      </Modal>
    </>
  );
}

export function Editor({ variable }: { variable: QueryVariable }) {
  const { datasource: datasourceRef, sort, refresh, query, regex } = variable.useState();
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
