import React, { useEffect, useState } from 'react';
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
  const [subscriptions, setSubscriptions] = useState<AzureMonitorOption[]>([]);

  useEffect(() => {
    datasource.azureMonitorDatasource
      .getSubscriptions()
      .then((results) => {
        const newSubscriptions = results.map((v) => ({ label: v.text, value: v.value, description: v.value }));
        setSubscriptions(newSubscriptions);
        setError(ERROR_SOURCE, undefined);

        if (!query.subscriptions || (query.subscriptions.length < 1 && newSubscriptions.length)) {
          onChange({
            ...query,
            subscriptions: [query.subscription ?? newSubscriptions[0].value],
          });
        }
      })
      .catch((err) => setError(ERROR_SOURCE, err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasource, onChange, setError]);

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
