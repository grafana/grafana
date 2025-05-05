import { useState, FormEvent } from 'react';

import { SelectableValue, DataSourceInstanceSettings, getDataSourceRef } from '@grafana/data';
import { QueryVariable, sceneGraph, SceneVariable } from '@grafana/scenes';
import { VariableRefresh, VariableSort } from '@grafana/schema';

import { QueryVariableEditorForm } from '../components/QueryVariableForm';
import { Button, Modal } from '@grafana/ui';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';
import { t } from 'app/core/internationalization';

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
    let definition: string;
    if (typeof query === 'string') {
      definition = query;
    } else if (query.hasOwnProperty('query') && typeof query.query === 'string') {
      definition = query.query;
    } else {
      definition = '';
    }
    variable.setState({ query, definition });
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
      title: t('dashboard-scene.query-variable-form.label-value', 'Value'),
      render: () => <Editor variable={variable} />,
    }),
  ];
}

function Editor({ variable }: { variable: QueryVariable }) {
  // const { value: dsConfig } = useAsync(async () => {
  //   const datasource = await getDataSourceSrv().get(datasourceRef ?? '');
  //   const VariableQueryEditor = await getVariableQueryEditor(datasource);
  //   const defaultQuery = datasource?.variables?.getDefaultQuery?.();

  //   if (!query && defaultQuery) {
  //     const query =
  //       typeof defaultQuery === 'string' ? defaultQuery : { ...defaultQuery, refId: defaultQuery.refId ?? 'A' };
  //     onQueryChange(query);
  //   }

  //   return { datasource, VariableQueryEditor };
  // }, [datasourceRef]);
  // const { datasource, VariableQueryEditor } = dsConfig ?? {};

  const [isOpen, setIsOpen] = useState(false);

  const onOpen = () => {
    setIsOpen(true);
  };

  return (
    <>
      <Button variant="secondary" fill="outline" onClick={onOpen}>Open Editor</Button>
      <Modal title="Query Variable" isOpen={isOpen}>
        <QueryVariableEditor variable={variable} onRunQuery={() => {}} />
      <Modal.ButtonRow>
        <Button variant="secondary" fill="outline" onClick={() => setIsOpen(false)}>
          Done
        </Button>
      </Modal.ButtonRow>
    </Modal>
    </>
  );
}