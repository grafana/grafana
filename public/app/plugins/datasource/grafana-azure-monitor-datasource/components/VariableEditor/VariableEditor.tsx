import { get } from 'lodash';
import React, { useEffect, useState } from 'react';
import { useEffectOnce } from 'react-use';

import { SelectableValue } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Alert, InlineField, Select } from '@grafana/ui';

import DataSource from '../../datasource';
import { migrateStringQueriesToObjectQueries } from '../../grafanaTemplateVariableFns';
import { AzureMonitorOption, AzureMonitorQuery, AzureQueryType } from '../../types';
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
  const { query, onChange, datasource } = props;
  const AZURE_QUERY_VARIABLE_TYPE_OPTIONS = [
    { label: 'Grafana Query Function', value: AzureQueryType.GrafanaTemplateVariableFn },
    { label: 'Logs', value: AzureQueryType.LogAnalytics },
  ];
  if (config.featureToggles.azTemplateVars) {
    AZURE_QUERY_VARIABLE_TYPE_OPTIONS.push({ label: 'Subscriptions', value: AzureQueryType.SubscriptionsQuery });
    AZURE_QUERY_VARIABLE_TYPE_OPTIONS.push({ label: 'Resource Groups', value: AzureQueryType.ResourceGroupsQuery });
  }
  const [variableOptionGroup, setVariableOptionGroup] = useState<{ label: string; options: AzureMonitorOption[] }>({
    label: 'Template Variables',
    options: [],
  });
  const [requireSubscription, setRequireSubscription] = useState(false);
  const [subscriptions, setSubscriptions] = useState<SelectableValue[]>([]);
  const [errorMessage, setError] = useLastError();
  const queryType = typeof query === 'string' ? '' : query.queryType;

  useEffect(() => {
    migrateStringQueriesToObjectQueries(query, { datasource: datasource }).then((migratedQuery) => {
      onChange(migratedQuery);
    });
  }, [query, datasource, onChange]);

  useEffect(() => {
    switch (queryType) {
      case AzureQueryType.ResourceGroupsQuery:
        setRequireSubscription(true);
        break;
      default:
        setRequireSubscription(false);
    }
  }, [queryType]);

  useEffect(() => {
    const options: AzureMonitorOption[] = [];
    datasource.getVariablesRaw().forEach((v) => {
      if (get(v, 'query.queryType') !== queryType) {
        options.push({ label: v.label || v.name, value: `$${v.name}` });
      }
    });
    setVariableOptionGroup({
      label: 'Template Variables',
      options,
    });
  }, [datasource, queryType]);

  useEffectOnce(() => {
    datasource.getSubscriptions().then((subs) => {
      setSubscriptions(subs.map((s) => ({ label: s.text, value: s.value })));
    });
  });

  if (typeof query === 'string') {
    // still migrating the query
    return null;
  }

  const onQueryTypeChange = (selectableValue: SelectableValue) => {
    if (selectableValue.value) {
      onChange({
        ...query,
        queryType: selectableValue.value,
      });
    }
  };

  const onChangeSubscription = (selectableValue: SelectableValue) => {
    if (selectableValue.value) {
      onChange({
        ...query,
        subscription: selectableValue.value,
      });
    }
  };

  const onLogsQueryChange = (queryChange: AzureMonitorQuery) => {
    onChange(queryChange);
  };

  return (
    <>
      <InlineField label="Select query type" labelWidth={20}>
        <Select
          aria-label="select query type"
          onChange={onQueryTypeChange}
          options={AZURE_QUERY_VARIABLE_TYPE_OPTIONS}
          width={25}
          value={queryType}
        />
      </InlineField>
      {typeof query === 'object' && query.queryType === AzureQueryType.LogAnalytics && (
        <>
          <LogsQueryEditor
            subscriptionId={query.subscription}
            query={query}
            datasource={datasource}
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
      {typeof query === 'object' && query.queryType === AzureQueryType.GrafanaTemplateVariableFn && (
        <GrafanaTemplateVariableFnInput query={query} updateQuery={props.onChange} datasource={datasource} />
      )}
      {typeof query === 'object' && requireSubscription && (
        <InlineField label="Select subscription" labelWidth={20}>
          <Select
            aria-label="select subscription"
            onChange={onChangeSubscription}
            options={subscriptions.concat(variableOptionGroup)}
            width={25}
            value={query.subscription}
          />
        </InlineField>
      )}
    </>
  );
};

export default VariableEditor;
