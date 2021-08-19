import React, { useEffect, useState, useRef } from 'react';
import { AzureMonitorErrorish, AzureMonitorOption, AzureMonitorQuery } from '../../types';
import Datasource from '../../datasource';
import { InlineFieldRow } from '@grafana/ui';
import SubscriptionField from '../SubscriptionField';
import QueryField from './QueryField';

interface LogsQueryEditorProps {
  query: AzureMonitorQuery;
  datasource: Datasource;
  subscriptionId?: string;
  onChange: (newQuery: AzureMonitorQuery) => void;
  variableOptionGroup: { label: string; options: AzureMonitorOption[] };
  setError: (source: string, error: AzureMonitorErrorish | undefined) => void;
}

const ERROR_SOURCE = 'arg-subscriptions';
const ArgQueryEditor: React.FC<LogsQueryEditorProps> = ({
  query,
  datasource,
  subscriptionId,
  variableOptionGroup,
  onChange,
  setError,
}) => {
  const fetchedRef = useRef(false);
  const [subscriptions, setSubscriptions] = useState<AzureMonitorOption[]>([]);

  useEffect(() => {
    if (fetchedRef.current) {
      return;
    }

    fetchedRef.current = true;
    datasource.azureMonitorDatasource
      .getSubscriptions()
      .then((results) => {
        const fetchedSubscriptions = results.map((v) => ({ label: v.text, value: v.value, description: v.value }));
        setSubscriptions(fetchedSubscriptions);
        setError(ERROR_SOURCE, undefined);

        if (!query.subscriptions?.length && fetchedSubscriptions?.length) {
          onChange({
            ...query,
            subscriptions: [query.subscription ?? fetchedSubscriptions[0].value],
          });
        }
      })
      .catch((err) => setError(ERROR_SOURCE, err));
  }, [datasource, onChange, query, setError]);

  return (
    <div data-testid="azure-monitor-logs-query-editor">
      <InlineFieldRow>
        <SubscriptionField
          multiSelect
          subscriptions={subscriptions}
          query={query}
          datasource={datasource}
          subscriptionId={subscriptionId}
          variableOptionGroup={variableOptionGroup}
          onQueryChange={onChange}
          setError={setError}
        />
      </InlineFieldRow>

      <QueryField
        query={query}
        datasource={datasource}
        subscriptionId={subscriptionId}
        variableOptionGroup={variableOptionGroup}
        onQueryChange={onChange}
        setError={setError}
      />
    </div>
  );
};

export default ArgQueryEditor;
