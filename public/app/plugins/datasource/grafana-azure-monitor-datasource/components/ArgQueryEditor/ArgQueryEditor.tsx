import React, { useEffect, useState, useRef } from 'react';

import { EditorFieldGroup, EditorRow, EditorRows } from '@grafana/ui';

import Datasource from '../../datasource';
import { AzureMonitorErrorish, AzureMonitorOption, AzureMonitorQuery } from '../../types';
import SubscriptionField from '../SubscriptionField';

import QueryField from './QueryField';

interface ArgQueryEditorProps {
  query: AzureMonitorQuery;
  datasource: Datasource;
  subscriptionId?: string;
  onChange: (newQuery: AzureMonitorQuery) => void;
  variableOptionGroup: { label: string; options: AzureMonitorOption[] };
  setError: (source: string, error: AzureMonitorErrorish | undefined) => void;
}

const ERROR_SOURCE = 'arg-subscriptions';
const ArgQueryEditor: React.FC<ArgQueryEditorProps> = ({
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
    datasource
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
    <span data-testid="azure-monitor-arg-query-editor-with-experimental-ui">
      <EditorRows>
        <EditorRow>
          <EditorFieldGroup>
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
          </EditorFieldGroup>
        </EditorRow>
      </EditorRows>
      <QueryField
        query={query}
        datasource={datasource}
        subscriptionId={subscriptionId}
        variableOptionGroup={variableOptionGroup}
        onQueryChange={onChange}
        setError={setError}
      />
    </span>
  );
};

export default ArgQueryEditor;
