import { useEffect, useState } from 'react';

import { EditorFieldGroup, EditorRow, EditorRows } from '@grafana/plugin-ui';
import { type ComboboxOption } from '@grafana/ui';

import { AzureHealthModelsQueryType, AzureQueryType } from '../../dataquery.gen';
import type Datasource from '../../datasource';
import { type AzureMonitorQuery } from '../../types/query';
import { type AzureMonitorErrorish, type VariableOptionGroup } from '../../types/types';

import HealthModelField from './HealthModelField';
import HealthModelsQueryTypeField from './HealthModelsQueryTypeField';
import SubscriptionField from './SubscriptionField';

interface HealthModelsQueryEditorProps {
  query: AzureMonitorQuery;
  datasource: Datasource;
  subscriptionId?: string;
  variableOptionGroup?: VariableOptionGroup;
  onChange: (newQuery: AzureMonitorQuery) => void;
  setError: (source: string, error: AzureMonitorErrorish | undefined) => void;
}

const SUBSCRIPTIONS_ERROR_SOURCE = 'health-models-subscriptions';
const HEALTH_MODELS_ERROR_SOURCE = 'health-models-list';
const DEFAULT_HEALTH_MODELS_QUERY_TYPE = AzureHealthModelsQueryType.EntityHealthSnapshot;
const HEALTH_MODELS_QUERY_TYPES = new Set<AzureHealthModelsQueryType>([
  AzureHealthModelsQueryType.EntityHealthSnapshot,
  AzureHealthModelsQueryType.EntityHealthHistory,
]);

const HealthModelsQueryEditor = ({
  query,
  datasource,
  subscriptionId,
  variableOptionGroup,
  onChange,
  setError,
}: HealthModelsQueryEditorProps) => {
  const [subscriptions, setSubscriptions] = useState<Array<ComboboxOption<string>>>([]);
  const [healthModels, setHealthModels] = useState<Array<ComboboxOption<string>>>([]);
  const [loadingSubscriptions, setLoadingSubscriptions] = useState(true);
  const selectedSubscription = query.subscription || subscriptionId || subscriptions[0]?.value;
  const [loadingHealthModels, setLoadingHealthModels] = useState(Boolean(selectedSubscription));
  const [healthModelsSource, setHealthModelsSource] = useState({ datasource, subscriptionId: selectedSubscription });

  // Reset before committing the new source so auto-selection cannot use stale models.
  if (healthModelsSource.datasource !== datasource || healthModelsSource.subscriptionId !== selectedSubscription) {
    setHealthModelsSource({ datasource, subscriptionId: selectedSubscription });
    setHealthModels([]);
    setLoadingHealthModels(Boolean(selectedSubscription));
  }

  const selectedHealthModelResourceId = query.azureHealthModels?.healthModelResourceId;
  const selectedHealthModelsQueryType = query.azureHealthModels?.queryType;
  const subscriptionOptions = variableOptionGroup
    ? [
        ...subscriptions,
        ...variableOptionGroup.options.map((option) => ({
          label: option.label,
          value: option.value,
          group: variableOptionGroup.label,
        })),
      ]
    : subscriptions;

  useEffect(() => {
    let canceled = false;

    datasource
      .getSubscriptions()
      .then((results) => {
        if (!canceled) {
          setSubscriptions(
            results.map((subscription) => ({
              label: subscription.text,
              value: subscription.value,
              description: subscription.value,
            }))
          );
          setError(SUBSCRIPTIONS_ERROR_SOURCE, undefined);
        }
      })
      .catch((error) => {
        if (!canceled) {
          setError(SUBSCRIPTIONS_ERROR_SOURCE, error);
        }
      })
      .finally(() => {
        if (!canceled) {
          setLoadingSubscriptions(false);
        }
      });

    return () => {
      canceled = true;
    };
  }, [datasource, setError]);

  useEffect(() => {
    let canceled = false;

    if (!selectedSubscription) {
      setError(HEALTH_MODELS_ERROR_SOURCE, undefined);
      return;
    }

    datasource
      .getHealthModels(selectedSubscription)
      .then((results) => {
        if (!canceled) {
          setHealthModels(
            results.map((healthModel) => ({
              label: healthModel.text,
              value: healthModel.value,
              description: healthModel.value,
            }))
          );
          setError(HEALTH_MODELS_ERROR_SOURCE, undefined);
        }
      })
      .catch((error) => {
        if (!canceled) {
          setError(HEALTH_MODELS_ERROR_SOURCE, error);
        }
      })
      .finally(() => {
        if (!canceled) {
          setLoadingHealthModels(false);
        }
      });

    return () => {
      canceled = true;
    };
  }, [datasource, selectedSubscription, setError]);

  useEffect(() => {
    const topHealthModelResourceId = healthModels[0]?.value;
    if (!topHealthModelResourceId || !selectedSubscription) {
      return;
    }

    if (selectedHealthModelResourceId && healthModels.some((model) => model.value === selectedHealthModelResourceId)) {
      return;
    }

    onChange({
      ...query,
      subscription: selectedSubscription,
      azureHealthModels: {
        ...query.azureHealthModels,
        healthModelResourceId: topHealthModelResourceId,
        queryType: query.azureHealthModels?.queryType ?? DEFAULT_HEALTH_MODELS_QUERY_TYPE,
      },
    });
  }, [healthModels, onChange, query, selectedHealthModelResourceId, selectedSubscription]);

  useEffect(() => {
    if (!selectedHealthModelResourceId || selectedHealthModelsQueryType) {
      return;
    }

    onChange({
      ...query,
      subscription: selectedSubscription,
      queryType: AzureQueryType.AzureHealthModels,
      azureHealthModels: {
        ...query.azureHealthModels,
        healthModelResourceId: selectedHealthModelResourceId,
        queryType: DEFAULT_HEALTH_MODELS_QUERY_TYPE,
      },
    });
  }, [onChange, query, selectedHealthModelResourceId, selectedHealthModelsQueryType, selectedSubscription]);

  const onSubscriptionChange = (selection: ComboboxOption<string>) => {
    onChange({
      ...query,
      subscription: selection.value,
      azureHealthModels: {
        ...query.azureHealthModels,
        healthModelResourceId: undefined,
      },
    });
  };

  const onHealthModelChange = (selection: ComboboxOption<string>) => {
    onChange({
      ...query,
      subscription: selectedSubscription,
      queryType: AzureQueryType.AzureHealthModels,
      azureHealthModels: {
        ...query.azureHealthModels,
        healthModelResourceId: selection.value,
        queryType: query.azureHealthModels?.queryType ?? DEFAULT_HEALTH_MODELS_QUERY_TYPE,
      },
    });
  };

  const onQueryTypeChange = (selection: ComboboxOption<AzureHealthModelsQueryType>) => {
    if (!selection.value || !HEALTH_MODELS_QUERY_TYPES.has(selection.value)) {
      return;
    }

    onChange({
      ...query,
      subscription: selectedSubscription,
      queryType: AzureQueryType.AzureHealthModels,
      azureHealthModels: {
        ...query.azureHealthModels,
        healthModelResourceId: selectedHealthModelResourceId,
        queryType: selection.value,
      },
    });
  };

  return (
    <EditorRows>
      <EditorRow>
        <EditorFieldGroup>
          <SubscriptionField
            subscriptions={subscriptionOptions}
            selectedSubscription={selectedSubscription}
            loadingSubscriptions={loadingSubscriptions}
            onSubscriptionChange={onSubscriptionChange}
          />
          <HealthModelField
            healthModels={healthModels}
            selectedHealthModelResourceId={selectedHealthModelResourceId}
            loadingHealthModels={loadingHealthModels}
            hasSelectedSubscription={Boolean(selectedSubscription)}
            onHealthModelChange={onHealthModelChange}
          />
          <HealthModelsQueryTypeField
            selectedHealthModelsQueryType={selectedHealthModelsQueryType}
            disabled={!selectedHealthModelResourceId}
            onQueryTypeChange={onQueryTypeChange}
          />
        </EditorFieldGroup>
      </EditorRow>
    </EditorRows>
  );
};

export default HealthModelsQueryEditor;
