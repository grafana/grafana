import { intersection } from 'lodash';
import React, { useState, useMemo } from 'react';

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

function selectSubscriptions(
  fetchedSubscriptions: string[],
  currentSubscriptions?: string[],
  currentSubscription?: string
) {
  let querySubscriptions = currentSubscriptions || [];
  if (querySubscriptions.length === 0 && currentSubscription) {
    querySubscriptions = [currentSubscription];
  }
  if (querySubscriptions.length === 0 && fetchedSubscriptions.length) {
    querySubscriptions = [fetchedSubscriptions[0]];
  }
  if (fetchedSubscriptions.length && intersection(querySubscriptions, fetchedSubscriptions).length === 0) {
    // If the current subscriptions are not in the fetched subscriptions, use the first one
    querySubscriptions = [fetchedSubscriptions[0]];
  }
  return querySubscriptions;
}

const ArgQueryEditor: React.FC<ArgQueryEditorProps> = ({
  query,
  datasource,
  subscriptionId,
  variableOptionGroup,
  onChange,
  setError,
}) => {
  const [subscriptions, setSubscriptions] = useState<AzureMonitorOption[]>([]);
  useMemo(() => {
    datasource
      .getSubscriptions()
      .then((results) => {
        const fetchedSubscriptions = results.map((v) => ({ label: v.text, value: v.value, description: v.value }));
        setSubscriptions(fetchedSubscriptions);
        setError(ERROR_SOURCE, undefined);

        onChange({
          ...query,
          subscriptions: selectSubscriptions(
            fetchedSubscriptions.map((v) => v.value),
            query.subscriptions,
            query.subscription
          ),
        });
      })
      .catch((err) => setError(ERROR_SOURCE, err));
    // We are only interested in re-fetching subscriptions if the data source changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasource]);

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
