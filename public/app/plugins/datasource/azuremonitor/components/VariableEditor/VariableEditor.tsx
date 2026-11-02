import { get, isEqual } from 'lodash';
import { useEffect, useState } from 'react';
import { useEffectOnce } from 'react-use';

import { type SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getTemplateSrv } from '@grafana/runtime';
import { Alert, Field, Select, Space, Stack } from '@grafana/ui';

import UrlBuilder from '../../azure_monitor/url_builder';
import { AzureQueryType } from '../../dataquery.gen';
import type DataSource from '../../datasource';
import { selectors } from '../../e2e/selectors';
import { migrateQuery } from '../../grafanaTemplateVariableFns';
import { type AzureMonitorQuery } from '../../types/query';
import { type AzureMonitorOption } from '../../types/types';
import useLastError from '../../utils/useLastError';
import ArgQueryEditor from '../ArgQueryEditor/ArgQueryEditor';
import LogsQueryEditor from '../LogsQueryEditor/LogsQueryEditor';
import { parseResourceURI } from '../ResourcePicker/utils';

import GrafanaTemplateVariableFnInput from './GrafanaTemplateVariableFn';

type Props = {
  query: AzureMonitorQuery | string;
  onChange: (query: AzureMonitorQuery) => void;
  datasource: DataSource;
};

const removeOption: SelectableValue = { label: '-', value: '' };

const VariableEditor = (props: Props) => {
  const { query, onChange, datasource } = props;

  const AZURE_QUERY_VARIABLE_TYPE_OPTIONS = [
    { label: 'Subscriptions', value: AzureQueryType.SubscriptionsQuery },
    { label: 'Resource Groups', value: AzureQueryType.ResourceGroupsQuery },
    { label: 'Namespaces', value: AzureQueryType.NamespacesQuery },
    { label: 'Regions', value: AzureQueryType.LocationsQuery },
    { label: 'Resource Names', value: AzureQueryType.ResourceNamesQuery },
    { label: 'Metric Names', value: AzureQueryType.MetricNamesQuery },
    { label: 'Dimensions', value: AzureQueryType.DimensionsQuery },
    { label: 'Dimension Values', value: AzureQueryType.DimensionValuesQuery },
    { label: 'Workspaces', value: AzureQueryType.WorkspacesQuery },
    { label: 'Resource Graph', value: AzureQueryType.AzureResourceGraph },
    { label: 'Logs', value: AzureQueryType.LogAnalytics },
    { label: 'Custom Namespaces', value: AzureQueryType.CustomNamespacesQuery },
    { label: 'Custom Metric Names', value: AzureQueryType.CustomMetricNamesQuery },
  ];
  if (typeof props.query === 'object' && props.query.queryType === AzureQueryType.GrafanaTemplateVariableFn) {
    // Add the option for the GrafanaTemplateVariableFn only if it's already in use
    AZURE_QUERY_VARIABLE_TYPE_OPTIONS.push({
      label: 'Grafana Query Function',
      value: AzureQueryType.GrafanaTemplateVariableFn,
    });
  }
  const [variableOptionGroup, setVariableOptionGroup] = useState<{ label: string; options: AzureMonitorOption[] }>({
    label: 'Template Variables',
    options: [],
  });
  const [requireSubscription, setRequireSubscription] = useState(false);
  const [hasResourceGroup, setHasResourceGroup] = useState(false);
  const [hasNamespace, setHasNamespace] = useState(false);
  const [hasRegion, setHasRegion] = useState(false);
  const [requireResourceGroup, setRequireResourceGroup] = useState(false);
  const [requireNamespace, setRequireNamespace] = useState(false);
  const [requireCustomNamespace, setRequireCustomNamespace] = useState(false);
  const [hasCustomNamespace, setHasCustomNamespace] = useState(false);
  const [requireResource, setRequireResource] = useState(false);
  const [subscriptions, setSubscriptions] = useState<SelectableValue[]>([]);
  const [resourceGroups, setResourceGroups] = useState<SelectableValue[]>([]);
  const [namespaces, setNamespaces] = useState<SelectableValue[]>([]);
  const [customNamespaces, setCustomNamespaces] = useState<SelectableValue[]>([]);
  const [resources, setResources] = useState<SelectableValue[]>([]);
  const [regions, setRegions] = useState<SelectableValue[]>([]);
  const [metricNames, setMetricNames] = useState<SelectableValue[]>([]);
  const [dimensions, setDimensions] = useState<SelectableValue[]>([]);
  const [errorMessage, setError] = useLastError();
  const queryType = typeof query === 'string' ? '' : query.queryType;
  const hasMetricDimensionCascade =
    queryType === AzureQueryType.DimensionsQuery || queryType === AzureQueryType.DimensionValuesQuery;

  useEffect(() => {
    migrateQuery(query, { datasource: datasource }).then((migratedQuery) => {
      if (!isEqual(query, migratedQuery)) {
        onChange(migratedQuery);
      }
    });
  }, [query, datasource, onChange]);

  useEffect(() => {
    setRequireSubscription(false);
    setHasResourceGroup(false);
    setHasNamespace(false);
    setHasRegion(false);
    setRequireResourceGroup(false);
    setRequireNamespace(false);
    setRequireResource(false);
    setRequireCustomNamespace(false);
    setHasCustomNamespace(false);
    switch (queryType) {
      case AzureQueryType.ResourceGroupsQuery:
      case AzureQueryType.WorkspacesQuery:
        setRequireSubscription(true);
        break;
      case AzureQueryType.NamespacesQuery:
        setRequireSubscription(true);
        setHasResourceGroup(true);
        break;
      case AzureQueryType.ResourceNamesQuery:
        setRequireSubscription(true);
        setHasResourceGroup(true);
        setHasNamespace(true);
        setHasRegion(true);
        break;
      case AzureQueryType.MetricNamesQuery:
        setRequireSubscription(true);
        setRequireResourceGroup(true);
        setRequireNamespace(true);
        setRequireResource(true);
        break;
      case AzureQueryType.DimensionsQuery:
      case AzureQueryType.DimensionValuesQuery:
        setRequireSubscription(true);
        setRequireResourceGroup(true);
        setRequireNamespace(true);
        setRequireResource(true);
        setHasCustomNamespace(true);
        break;
      case AzureQueryType.LocationsQuery:
        setRequireSubscription(true);
        break;
      case AzureQueryType.CustomNamespacesQuery:
        setRequireSubscription(true);
        setRequireResourceGroup(true);
        setRequireNamespace(true);
        setRequireResource(true);
        break;
      case AzureQueryType.CustomMetricNamesQuery:
        setRequireSubscription(true);
        setRequireResourceGroup(true);
        setRequireResource(true);
        setRequireNamespace(true);
        setRequireCustomNamespace(true);
        break;
    }
  }, [queryType]);

  useEffect(() => {
    const options: AzureMonitorOption[] = [];
    datasource.getVariablesRaw().forEach((v) => {
      if (get(v, 'query.queryType') !== queryType) {
        options.push({ label: `$${v.name}`, value: `$${v.name}` });
      }
    });
    setVariableOptionGroup({
      label: 'Template Variables',
      options,
    });
  }, [datasource, queryType]);

  // Always retrieve subscriptions first as they're used in most template variable queries
  useEffectOnce(() => {
    datasource.getSubscriptions().then((subs) => {
      setSubscriptions(subs.map((s) => ({ label: s.text, value: s.value })));
    });
  });

  const subscription = typeof query === 'object' && query.subscription;
  // When subscription is set, retrieve resource groups
  useEffect(() => {
    if (subscription) {
      datasource.getResourceGroups(subscription).then((rgs) => {
        setResourceGroups(rgs.map((s) => ({ label: s.resourceGroupName, value: s.resourceGroupName })));
      });
    }
  }, [datasource, subscription]);

  const resourceGroup = (typeof query === 'object' && query.resourceGroup) || '';
  // When resource group is set, retrieve metric namespaces (aka resource types for a custom metric and custom metric namespace query)
  useEffect(() => {
    if (subscription && resourceGroup) {
      datasource.getMetricNamespaces(subscription, resourceGroup, undefined, false, true).then((rgs) => {
        setNamespaces(rgs.map((s) => ({ label: s.text, value: s.value })));
      });
    }
  }, [datasource, subscription, resourceGroup]);

  // When subscription is set also retrieve locations
  useEffect(() => {
    if (subscription) {
      datasource.azureMonitorDatasource.getLocations([subscription]).then((rgs) => {
        const regions: SelectableValue[] = [];
        rgs.forEach((r) => regions.push({ label: r.displayName, value: r.name }));
        setRegions(regions);
      });
    }
  }, [datasource, subscription, resourceGroup]);

  const namespace = (typeof query === 'object' && query.namespace) || '';
  // When subscription, resource group, and namespace are all set, retrieve resource names
  useEffect(() => {
    if (subscription && resourceGroup && namespace) {
      datasource.getResourceNames(subscription, resourceGroup, namespace).then((resources) => {
        setResources(
          resources.map((s) => {
            const parsedResource = parseResourceURI(s.id);
            return { label: s.name, value: parsedResource.resourceName };
          })
        );
      });
    }
  }, [datasource, subscription, resourceGroup, namespace]);

  const resource = (typeof query === 'object' && query.resource) || '';
  // When subscription, resource group, namespace, and resource name are all set, retrieve custom metric namespaces
  useEffect(() => {
    if (subscription && resourceGroup && namespace && resource) {
      const resourceUri = UrlBuilder.buildResourceUri(getTemplateSrv(), {
        subscription,
        resourceGroup,
        metricNamespace: namespace,
        resourceName: resource,
      });
      datasource.getMetricNamespaces(subscription, resourceGroup, resourceUri, true).then((rgs) => {
        setCustomNamespaces(rgs.map((s) => ({ label: s.text, value: s.value })));
      });
    }
  }, [datasource, subscription, resourceGroup, namespace, resource]);

  const customNamespace = (typeof query === 'object' && query.customNamespace) || '';
  const metricName = (typeof query === 'object' && query.metricName) || '';
  // Metric names are only needed for Dimensions / Dimension Values cascade fields
  useEffect(() => {
    if (hasMetricDimensionCascade && subscription && resourceGroup && namespace && resource) {
      datasource
        .getMetricNames(subscription, resourceGroup, namespace, resource, customNamespace || undefined)
        .then((metrics) => {
          setMetricNames(metrics.map((metric) => ({ label: metric.text, value: metric.value })));
        });
    }
  }, [datasource, hasMetricDimensionCascade, subscription, resourceGroup, namespace, resource, customNamespace]);

  // When a metric is also selected, retrieve the dimensions it supports
  useEffect(() => {
    if (
      queryType === AzureQueryType.DimensionValuesQuery &&
      subscription &&
      resourceGroup &&
      namespace &&
      resource &&
      metricName
    ) {
      datasource.azureMonitorDatasource
        .getMetricMetadata({
          subscription,
          resourceGroup,
          metricNamespace: namespace,
          resourceName: resource,
          customNamespace: customNamespace || undefined,
          metricName,
        })
        .then((metadata) => {
          setDimensions(metadata.dimensions);
        });
    }
  }, [datasource, queryType, subscription, resourceGroup, namespace, resource, customNamespace, metricName]);

  if (typeof query === 'string') {
    // still migrating the query
    return null;
  }

  const onQueryTypeChange = (selectableValue: SelectableValue) => {
    if (selectableValue.value) {
      onChange({
        ...query,
        queryType: selectableValue.value,
        subscription: undefined,
        resourceGroup: undefined,
        namespace: undefined,
        resource: undefined,
        region: undefined,
        customNamespace: undefined,
        metricName: undefined,
        dimension: undefined,
      });
    }
  };

  const onChangeSubscription = (selectableValue: SelectableValue) => {
    if (selectableValue.value) {
      onChange({
        ...query,
        subscription: selectableValue.value,
        resourceGroup: undefined,
        namespace: undefined,
        resource: undefined,
        ...(hasMetricDimensionCascade && {
          customNamespace: undefined,
          metricName: undefined,
          dimension: undefined,
        }),
      });
    }
  };

  const onChangeResourceGroup = (selectableValue: SelectableValue) => {
    onChange({
      ...query,
      resourceGroup: selectableValue.value,
      namespace: undefined,
      resource: undefined,
      ...(hasMetricDimensionCascade && {
        customNamespace: undefined,
        metricName: undefined,
        dimension: undefined,
      }),
    });
  };

  const onChangeNamespace = (selectableValue: SelectableValue) => {
    onChange({
      ...query,
      namespace: selectableValue.value,
      resource: undefined,
      ...(hasMetricDimensionCascade && {
        customNamespace: undefined,
        metricName: undefined,
        dimension: undefined,
      }),
    });
  };

  const onChangeRegion = (selectableValue: SelectableValue) => {
    onChange({
      ...query,
      region: selectableValue.value,
    });
  };

  const onChangeResource = (selectableValue: SelectableValue) => {
    onChange({
      ...query,
      resource: selectableValue.value,
      ...(hasMetricDimensionCascade && {
        customNamespace: undefined,
        metricName: undefined,
        dimension: undefined,
      }),
    });
  };

  const onQueryChange = (queryChange: AzureMonitorQuery) => {
    onChange(queryChange);
  };

  const onChangeCustomNamespace = (selectableValue: SelectableValue) => {
    onChange({
      ...query,
      customNamespace: selectableValue.value,
      metricName: undefined,
      dimension: undefined,
    });
  };

  const onChangeMetricName = (selectableValue: SelectableValue) => {
    onChange({
      ...query,
      metricName: selectableValue.value,
      dimension: undefined,
    });
  };

  const onChangeDimension = (selectableValue: SelectableValue) => {
    onChange({
      ...query,
      dimension: selectableValue.value,
    });
  };

  return (
    <Stack direction="column" gap={2}>
      <Field
        noMargin
        label={t('components.variable-editor.label-query-type', 'Query Type')}
        data-testid={selectors.components.variableEditor.queryType.input}
      >
        <Select
          aria-label={t('components.variable-editor.aria-label-select-query-type', 'Select query type')}
          onChange={onQueryTypeChange}
          options={AZURE_QUERY_VARIABLE_TYPE_OPTIONS}
          width={25}
          value={queryType}
        />
      </Field>
      {query.queryType === AzureQueryType.LogAnalytics && (
        <div>
          <LogsQueryEditor
            subscriptionId={query.subscription}
            query={query}
            datasource={datasource}
            onChange={onQueryChange}
            // Not applicable as the builder isn't available in the variable editor yet
            onQueryChange={onQueryChange}
            variableOptionGroup={variableOptionGroup}
            setError={setError}
            hideFormatAs={true}
            basicLogsEnabled={datasource.azureMonitorDatasource.basicLogsEnabled ?? false}
            auxiliaryLogsEnabled={datasource.azureMonitorDatasource.auxiliaryLogsEnabled ?? false}
          />
          {errorMessage && (
            <>
              <Space v={2} />
              <Alert
                severity="error"
                title={t(
                  'components.variable-editor.title-error-occurred',
                  'An error occurred while requesting metadata from Azure Monitor'
                )}
              >
                {errorMessage instanceof Error ? errorMessage.message : errorMessage}
              </Alert>
            </>
          )}
        </div>
      )}
      {query.queryType === AzureQueryType.GrafanaTemplateVariableFn && (
        <GrafanaTemplateVariableFnInput query={query} updateQuery={props.onChange} datasource={datasource} />
      )}
      {requireSubscription && (
        <Field
          noMargin
          label={t('components.variable-editor.label-subscription', 'Subscription')}
          data-testid={selectors.components.variableEditor.subscription.input}
        >
          <Select
            aria-label={t('components.variable-editor.aria-label-select-subscription', 'Select subscription')}
            onChange={onChangeSubscription}
            options={subscriptions.concat(variableOptionGroup)}
            width={25}
            value={query.subscription || null}
          />
        </Field>
      )}
      {(requireResourceGroup || hasResourceGroup) && (
        <Field
          noMargin
          label={t('components.variable-editor.label-resource-group', 'Resource Group')}
          data-testid={selectors.components.variableEditor.resourceGroup.input}
        >
          <Select
            aria-label={t('components.variable-editor.aria-label-select-resource-group', 'Select resource group')}
            onChange={onChangeResourceGroup}
            options={
              requireResourceGroup
                ? resourceGroups.concat(variableOptionGroup)
                : resourceGroups.concat(variableOptionGroup, removeOption)
            }
            width={25}
            value={query.resourceGroup || null}
            placeholder={
              requireResourceGroup ? undefined : t('components.variable-editor.placeholder-resource-group', 'Optional')
            }
          />
        </Field>
      )}
      {(requireNamespace || hasNamespace) && (
        <Field
          noMargin
          label={
            queryType === AzureQueryType.CustomNamespacesQuery || queryType === AzureQueryType.CustomMetricNamesQuery
              ? t('components.variable-editor.label-resource-type', 'Resource Type')
              : t('components.variable-editor.label-namespace', 'Namespace')
          }
          data-testid={selectors.components.variableEditor.namespace.input}
        >
          <Select
            aria-label={t('components.variable-editor.aria-label-select-namespace', 'Select namespace')}
            onChange={onChangeNamespace}
            options={
              requireNamespace
                ? namespaces.concat(variableOptionGroup)
                : namespaces.concat(variableOptionGroup, removeOption)
            }
            width={25}
            value={query.namespace || null}
            placeholder={
              requireNamespace ? undefined : t('components.variable-editor.placeholder-namespace', 'Optional')
            }
          />
        </Field>
      )}
      {hasRegion && (
        <Field
          noMargin
          label={t('components.variable-editor.label-region', 'Region')}
          data-testid={selectors.components.variableEditor.region.input}
        >
          <Select
            aria-label={t('components.variable-editor.aria-label-select-region', 'Select region')}
            onChange={onChangeRegion}
            options={regions.concat(variableOptionGroup)}
            width={25}
            value={query.region || null}
            placeholder={t('components.variable-editor.placeholder-region', 'Optional')}
          />
        </Field>
      )}
      {requireResource && (
        <Field
          noMargin
          label={t('components.variable-editor.label-resource', 'Resource')}
          data-testid={selectors.components.variableEditor.resource.input}
        >
          <Select
            aria-label={t('components.variable-editor.aria-label-select-resource', 'Select resource')}
            onChange={onChangeResource}
            options={resources.concat(variableOptionGroup)}
            width={25}
            value={query.resource || null}
          />
        </Field>
      )}
      {(requireCustomNamespace || hasCustomNamespace) && (
        <Field
          noMargin
          label={t('components.variable-editor.label-custom-namespace', 'Custom Namespace')}
          data-testid={selectors.components.variableEditor.customNamespace.input}
        >
          <Select
            aria-label={t('components.variable-editor.aria-label-select-custom-namespace', 'Select custom namespace')}
            onChange={onChangeCustomNamespace}
            options={
              requireCustomNamespace
                ? customNamespaces.concat(variableOptionGroup)
                : customNamespaces.concat(variableOptionGroup, removeOption)
            }
            width={25}
            value={query.customNamespace || null}
            placeholder={
              requireCustomNamespace
                ? undefined
                : t('components.variable-editor.placeholder-custom-namespace', 'Optional')
            }
          />
        </Field>
      )}
      {hasMetricDimensionCascade && (
        <Field
          noMargin
          label={t('components.variable-editor.label-metric-name', 'Metric Name')}
          data-testid={selectors.components.variableEditor.metricName.input}
        >
          <Select
            aria-label={t('components.variable-editor.aria-label-select-metric-name', 'Select metric name')}
            onChange={onChangeMetricName}
            options={metricNames.concat(variableOptionGroup)}
            width={25}
            value={query.metricName || null}
          />
        </Field>
      )}
      {hasMetricDimensionCascade && query.queryType === AzureQueryType.DimensionValuesQuery && (
        <Field
          noMargin
          label={t('components.variable-editor.label-dimension-name', 'Dimension Name')}
          data-testid={selectors.components.variableEditor.dimension.input}
        >
          <Select
            aria-label={t('components.variable-editor.aria-label-select-dimension-name', 'Select dimension name')}
            onChange={onChangeDimension}
            options={dimensions.concat(variableOptionGroup)}
            width={25}
            value={query.dimension || null}
          />
        </Field>
      )}
      {query.queryType === AzureQueryType.AzureResourceGraph && (
        <div>
          <ArgQueryEditor
            subscriptionId={datasource.azureLogAnalyticsDatasource.defaultSubscriptionId}
            query={query}
            datasource={datasource}
            onChange={onQueryChange}
            variableOptionGroup={variableOptionGroup}
            setError={setError}
          />
          {errorMessage && (
            <>
              <Space v={2} />
              <Alert
                severity="error"
                title={t(
                  'components.variable-editor.title-error-occurred',
                  'An error occurred while requesting metadata from Azure Monitor'
                )}
              >
                {errorMessage instanceof Error ? errorMessage.message : errorMessage}
              </Alert>
            </>
          )}
        </div>
      )}
    </Stack>
  );
};

export default VariableEditor;
