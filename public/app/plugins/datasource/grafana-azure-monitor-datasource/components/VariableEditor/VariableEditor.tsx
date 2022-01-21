import { SelectableValue } from '@grafana/data';
import { Alert, InlineField, Input, Select } from '@grafana/ui';
import React, { ChangeEvent, useCallback, useEffect, useState } from 'react';
import { AzureMonitorQuery, AzureQueryType } from '../../types';
import LogsQueryEditor from '../LogsQueryEditor';
import DataSource from '../../datasource';
import useLastError from '../../utils/useLastError';
import { Space } from '../Space';
import { migrateStringQueriesToObjectQueries } from '../../grafanaTemplateVariableFns';

const AZURE_QUERY_VARIABLE_TYPE_OPTIONS = [
  { label: 'Grafana Query Function', value: AzureQueryType.GrafanaTemplateVariableFn },
  { label: 'Logs', value: AzureQueryType.LogAnalytics },
];

const GrafanaTemplateVariableFnInput = ({
  query,
  updateQuery,
  datasource,
}: {
  query: AzureMonitorQuery;
  updateQuery: (val: AzureMonitorQuery) => void;
  datasource: DataSource;
}) => {
  const [inputVal, setInputVal] = useState('');
  useEffect(() => {
    setInputVal(query.grafanaTemplateVariableFn?.rawQuery || '');
  }, [query.grafanaTemplateVariableFn?.rawQuery]);

  const onRunQuery = useCallback(
    (newQuery: string) => {
      migrateStringQueriesToObjectQueries(newQuery, { datasource }).then((updatedQuery) => {
        if (updatedQuery.queryType === AzureQueryType.GrafanaTemplateVariableFn) {
          updateQuery(updatedQuery);
        } else {
          updateQuery({
            ...query,
            grafanaTemplateVariableFn: {
              kind: 'UnknownQuery',
              rawQuery: newQuery,
            },
          });
        }
      });
    },
    [datasource, query, updateQuery]
  );

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    setInputVal(event.target.value);
  };

  return (
    <InlineField label="Grafana template variable function">
      <Input
        placeholder={'type a grafana template variable function, ex: Subscriptions()'}
        value={inputVal}
        onChange={onChange}
        onBlur={() => onRunQuery(inputVal)}
      />
    </InlineField>
  );
};

type Props = {
  query: AzureMonitorQuery | string;
  onChange: (query: AzureMonitorQuery) => void;
  datasource: DataSource;
};

const VariableEditor = (props: Props) => {
  const defaultQuery: AzureMonitorQuery = {
    refId: 'A',
    queryType: AzureQueryType.GrafanaTemplateVariableFn,
  };
  const [query, setQuery] = useState(defaultQuery);

  useEffect(() => {
    migrateStringQueriesToObjectQueries(props.query, { datasource: props.datasource }).then((migratedQuery) => {
      setQuery(migratedQuery);
    });
  }, [props.query, props.datasource]);

  const onQueryTypeChange = (selectableValue: SelectableValue) => {
    if (selectableValue.value) {
      setQuery({
        ...query,
        queryType: selectableValue.value,
      });
    }
  };
  const onLogsQueryChange = (queryChange: AzureMonitorQuery) => {
    setQuery(queryChange);

    // only hit backend if there's something to query (prevents error when selecting the resource before pinging a query)
    if (queryChange.azureLogAnalytics?.query) {
      props.onChange(queryChange);
    }
  };

  const [errorMessage, setError] = useLastError();

  const variableOptionGroup = {
    label: 'Template Variables',
    // TODO: figure out a way to filter out the current variable from the variables list
    // options: props.datasource.getVariables().map((v) => ({ label: v, value: v })),
    options: [],
  };

  return (
    <>
      <InlineField label="Select query type">
        <Select
          aria-label="select query type"
          onChange={onQueryTypeChange}
          options={AZURE_QUERY_VARIABLE_TYPE_OPTIONS}
          width={25}
          value={query.queryType}
        />
      </InlineField>
      {query.queryType === AzureQueryType.LogAnalytics && (
        <>
          <LogsQueryEditor
            subscriptionId={query.subscription}
            query={query}
            datasource={props.datasource}
            onChange={onLogsQueryChange}
            variableOptionGroup={variableOptionGroup}
            setError={setError}
            hideFormatAs={true}
          />
          {errorMessage && (
            <>
              <Space v={2} />
              <Alert severity="error" title="An error occurred while requesting metadata from Azure Monitor">
                {errorMessage}
              </Alert>
            </>
          )}
        </>
      )}
      {query.queryType === AzureQueryType.GrafanaTemplateVariableFn && (
        <GrafanaTemplateVariableFnInput query={query} updateQuery={props.onChange} datasource={props.datasource} />
      )}
    </>
  );
};

export default VariableEditor;
