import { intersection } from 'lodash';
import React, { useState, useMemo } from 'react';

import { EditorFieldGroup, EditorRow, EditorRows } from '@grafana/experimental';

import Datasource from '../../datasource';
import { selectors } from '../../e2e/selectors';
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
  const commonSubscriptions = intersection(querySubscriptions, fetchedSubscriptions);
  if (fetchedSubscriptions.length && querySubscriptions.length > commonSubscriptions.length) {
    // If not all of the query subscriptions are in the list of fetched subscriptions, then
    // select only the ones present (or the first one if none is present)
    querySubscriptions = commonSubscriptions.length > 0 ? commonSubscriptions : [fetchedSubscriptions[0]];
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
    <span data-testid={selectors.components.queryEditor.argsQueryEditor.container.input}>
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
