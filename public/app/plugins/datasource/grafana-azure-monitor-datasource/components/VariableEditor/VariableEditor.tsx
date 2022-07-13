import React, { useEffect, useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Alert, InlineField, Select } from '@grafana/ui';

import DataSource from '../../datasource';
import { migrateStringQueriesToObjectQueries } from '../../grafanaTemplateVariableFns';
import { AzureMonitorQuery, AzureQueryType } from '../../types';
import useLastError from '../../utils/useLastError';
import LogsQueryEditor from '../LogsQueryEditor';
import { Space } from '../Space';

import GrafanaTemplateVariableFnInput from './GrafanaTemplateVariableFn';

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
  const AZURE_QUERY_VARIABLE_TYPE_OPTIONS = [
    { label: 'Grafana Query Function', value: AzureQueryType.GrafanaTemplateVariableFn },
    { label: 'Logs', value: AzureQueryType.LogAnalytics },
  ];
  if (config.featureToggles.azTemplateVars) {
    AZURE_QUERY_VARIABLE_TYPE_OPTIONS.push({ label: 'Subscriptions', value: AzureQueryType.SubscriptionsQuery });
  }

  const [query, setQuery] = useState(defaultQuery);

  useEffect(() => {
    migrateStringQueriesToObjectQueries(props.query, { datasource: props.datasource }).then((migratedQuery) => {
      setQuery(migratedQuery);
    });
  }, [props.query, props.datasource]);

  const onQueryTypeChange = (selectableValue: SelectableValue) => {
    if (selectableValue.value) {
      const newQuery = {
        ...query,
        queryType: selectableValue.value,
      };
      setQuery(newQuery);
      props.onChange(newQuery);
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
      <InlineField label="Select query type" labelWidth={20}>
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
