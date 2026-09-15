import { useEffect, useMemo, useState } from 'react';

import { t } from '@grafana/i18n';
import { EditorFieldGroup, EditorRow, EditorRows } from '@grafana/plugin-ui';
import { Combobox, type ComboboxOption } from '@grafana/ui';

import { parseHealthModelResourceId } from '../../azure_health_models/azure_health_models_datasource';
import { type HealthModel, type HealthModelsResultFormat } from '../../azure_health_models/types';
import type Datasource from '../../datasource';
import { selectors } from '../../e2e/selectors';
import { type AzureMonitorQuery } from '../../types/query';
import { type AzureMonitorErrorish, type AzureMonitorOption } from '../../types/types';
import { Field } from '../shared/Field';

interface HealthModelsQueryEditorProps {
  query: AzureMonitorQuery;
  datasource: Datasource;
  subscriptionId?: string;
  onChange: (newQuery: AzureMonitorQuery) => void;
  variableOptionGroup: { label: string; options: AzureMonitorOption[] };
  setError: (source: string, error: AzureMonitorErrorish | undefined) => void;
}

const SUBSCRIPTIONS_ERROR_SOURCE = 'health-models-subscriptions';
const HEALTH_MODELS_ERROR_SOURCE = 'health-models-list';

const RESULT_FORMAT_OPTIONS: Array<ComboboxOption<HealthModelsResultFormat>> = [
  {
    label: 'Health Model Entities',
    value: 'entities',
    description: 'Point-in-time entity health at the end of the selected time range, as a table.',
  },
  {
    label: 'Health Model Graph',
    value: 'modelGraph',
    description:
      'Point-in-time entity health and relationships at the end of the selected time range, for the Node graph panel.',
  },
  {
    label: 'Health Model Entity History',
    value: 'timeSeries',
    description: 'Entity health-state history over the dashboard time range.',
  },
];

const HealthModelsQueryEditor = ({
  query,
  datasource,
  subscriptionId,
  onChange,
  variableOptionGroup,
  setError,
}: HealthModelsQueryEditorProps) => {
  const [subscriptions, setSubscriptions] = useState<Array<ComboboxOption<string>>>([]);
  const [healthModels, setHealthModels] = useState<Array<ComboboxOption<string>>>([]);
  const [loadingSubscriptions, setLoadingSubscriptions] = useState(false);
  const [loadingHealthModels, setLoadingHealthModels] = useState(false);
  const selectedSubscription = query.subscription || subscriptionId || subscriptions[0]?.value;
  const selectedHealthModelId = query.azureHealthModels?.healthModelId;

  useEffect(() => {
    let canceled = false;
    setLoadingSubscriptions(true);

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
    if (query.subscription || !selectedSubscription) {
      return;
    }

    onChange({
      ...query,
      subscription: selectedSubscription,
      azureHealthModels: query.azureHealthModels ?? {},
    });
  }, [onChange, query, selectedSubscription]);

  useEffect(() => {
    let canceled = false;
    setHealthModels([]);

    if (!selectedSubscription || selectedSubscription.includes('$')) {
      setLoadingHealthModels(false);
      return;
    }

    setLoadingHealthModels(true);
    datasource.azureHealthModelsDatasource
      .getHealthModels(selectedSubscription)
      .then((models) => {
        if (!canceled) {
          setHealthModels(models.map(toHealthModelOption));
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

  const subscriptionOptions = useMemo(
    () => addTemplateVariables(subscriptions, variableOptionGroup),
    [subscriptions, variableOptionGroup]
  );
  const healthModelOptions = useMemo(
    () => addTemplateVariables(healthModels, variableOptionGroup),
    [healthModels, variableOptionGroup]
  );

  const onSubscriptionChange = (selection: ComboboxOption<string>) => {
    onChange({
      ...query,
      subscription: selection.value,
      azureHealthModels: {
        ...query.azureHealthModels,
        healthModelId: undefined,
      },
    });
  };

  const onHealthModelChange = (selection: ComboboxOption<string>) => {
    onChange({
      ...query,
      subscription: selectedSubscription,
      azureHealthModels: {
        ...query.azureHealthModels,
        healthModelId: selection.value,
      },
    });
  };

  const onResultFormatChange = (selection: ComboboxOption<HealthModelsResultFormat>) => {
    onChange({
      ...query,
      azureHealthModels: {
        ...query.azureHealthModels,
        resultFormat: selection.value,
      },
    });
  };

  return (
    <span data-testid={selectors.components.queryEditor.healthModelsQueryEditor.container.input}>
      <EditorRows>
        <EditorRow>
          <EditorFieldGroup>
            <Field
              label={t('components.health-models-query-editor.label-subscription', 'Subscription')}
              data-testid={selectors.components.queryEditor.healthModelsQueryEditor.subscription.input}
            >
              <Combobox
                aria-label={t(
                  'components.health-models-query-editor.aria-label-subscription',
                  'Health Models subscription'
                )}
                options={subscriptionOptions}
                value={selectedSubscription}
                onChange={onSubscriptionChange}
                loading={loadingSubscriptions}
                createCustomValue
                width={36}
              />
            </Field>
            <Field
              label={t('components.health-models-query-editor.label-health-model', 'Health Model')}
              data-testid={selectors.components.queryEditor.healthModelsQueryEditor.healthModel.input}
            >
              <Combobox
                aria-label={t('components.health-models-query-editor.aria-label-health-model', 'Azure Health Model')}
                options={healthModelOptions}
                value={selectedHealthModelId}
                onChange={onHealthModelChange}
                loading={loadingHealthModels}
                disabled={!selectedSubscription}
                createCustomValue
                width={48}
              />
            </Field>
            <Field label={t('components.health-models-query-editor.label-format', 'Format')}>
              <Combobox
                aria-label={t('components.health-models-query-editor.aria-label-format', 'Result format')}
                options={RESULT_FORMAT_OPTIONS}
                value={query.azureHealthModels?.resultFormat ?? 'entities'}
                onChange={onResultFormatChange}
                disabled={!selectedHealthModelId}
                width={24}
              />
            </Field>
          </EditorFieldGroup>
        </EditorRow>
      </EditorRows>
    </span>
  );
};

function toHealthModelOption(healthModel: HealthModel): ComboboxOption<string> {
  const resourceGroupName = parseHealthModelResourceId(healthModel.id).resourceGroupName;

  return {
    label: `${healthModel.name} (${resourceGroupName})`,
    value: healthModel.id,
    description: healthModel.id,
  };
}

function addTemplateVariables(
  options: Array<ComboboxOption<string>>,
  variableOptionGroup: { label: string; options: AzureMonitorOption[] }
): Array<ComboboxOption<string>> {
  return [
    ...options,
    ...variableOptionGroup.options.map((option) => ({
      label: option.label,
      value: option.value,
      group: variableOptionGroup.label,
    })),
  ];
}

export default HealthModelsQueryEditor;
