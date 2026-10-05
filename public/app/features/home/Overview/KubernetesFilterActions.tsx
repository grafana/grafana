import { useMemo } from 'react';
import { Controller, type UseFormReturn } from 'react-hook-form';
import { useAsync } from 'react-use';

import { type DataSourceInstanceListItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Combobox, type ComboboxOption, Field, MultiCombobox } from '@grafana/ui';

import { hasSelection, type KubernetesScope } from '../solutions/kubernetesData';
import {
  fetchKubernetesLabelValues,
  parseKubernetesFilter,
  summarizeKubernetesFilter,
} from '../solutions/kubernetesFilter';

import { type CardFilterActionsProps, SolutionFilterActions, type SolutionFilterSpec } from './SolutionFilterActions';

const NO_SCOPE: KubernetesScope = { cluster: '', namespaces: [], nodes: [] };

/** Names of the dimensions a scope sets, for analytics; the values are customer data and never leave the browser. */
function customizedDimensions(scope: KubernetesScope): string {
  const dimensions: string[] = [];
  if (scope.cluster !== '') {
    dimensions.push('cluster');
  }
  if (scope.namespaces.length > 0) {
    dimensions.push('namespaces');
  }
  if (scope.nodes.length > 0) {
    dimensions.push('nodes');
  }
  return dimensions.join(',');
}

const spec: SolutionFilterSpec<KubernetesScope> = {
  solution: 'kubernetes',
  parse: parseKubernetesFilter,
  summarize: summarizeKubernetesFilter,
  defaultValues: (filter) =>
    filter ? { cluster: filter.cluster, namespaces: filter.namespaces, nodes: filter.nodes } : NO_SCOPE,
  hasSelection,
  customized: customizedDimensions,
};

export function KubernetesFilterActions({ datasource }: CardFilterActionsProps) {
  return (
    <SolutionFilterActions
      spec={spec}
      datasource={datasource}
      openLabel={t('home.solutions.kubernetes.filter.open', 'Filter by cluster, namespace, or node')}
      title={t('home.solutions.kubernetes.filter.title', 'Filter Kubernetes Monitoring')}
    >
      {(form) => <KubernetesFilterFields datasource={datasource} form={form} />}
    </SolutionFilterActions>
  );
}

interface KubernetesFilterFieldsProps {
  datasource: DataSourceInstanceListItem;
  form: UseFormReturn<KubernetesScope>;
}

function KubernetesFilterFields({ datasource, form: { control, watch } }: KubernetesFilterFieldsProps) {
  const cluster = watch('cluster');
  const clusters = useAsync(() => fetchKubernetesLabelValues(datasource.uid, 'cluster', ''), [datasource.uid]);
  // Namespace and node lists follow the chosen cluster ('' = every cluster).
  const namespaces = useAsync(
    () => fetchKubernetesLabelValues(datasource.uid, 'namespace', cluster),
    [datasource.uid, cluster]
  );
  const nodes = useAsync(() => fetchKubernetesLabelValues(datasource.uid, 'node', cluster), [datasource.uid, cluster]);
  // A rejected lookup leaves the value undefined: an empty list, with custom entry still allowed.
  const clusterOptions = useMemo(() => toOptions(clusters.value), [clusters.value]);
  const namespaceOptions = useMemo(() => toOptions(namespaces.value), [namespaces.value]);
  const nodeOptions = useMemo(() => toOptions(nodes.value), [nodes.value]);

  return (
    <>
      {/* Each select is locked until its own values arrive; the namespace and node lists reload per cluster. */}
      <Field
        label={t('home.solutions.kubernetes.filter.cluster', 'Cluster')}
        htmlFor="kubernetes-filter-cluster"
        noMargin
      >
        <Controller
          control={control}
          name="cluster"
          render={({ field }) => (
            <Combobox<string>
              id="kubernetes-filter-cluster"
              options={clusterOptions}
              value={field.value || null}
              isClearable
              createCustomValue
              loading={clusters.loading}
              disabled={clusters.loading}
              placeholder={t('home.solutions.kubernetes.filter.all-clusters', 'All clusters')}
              onChange={(option) => field.onChange(option?.value ?? '')}
            />
          )}
        />
      </Field>
      <Field
        label={t('home.solutions.kubernetes.filter.namespaces', 'Namespaces')}
        htmlFor="kubernetes-filter-namespaces"
        noMargin
      >
        <Controller
          control={control}
          name="namespaces"
          render={({ field }) => (
            <MultiCombobox<string>
              id="kubernetes-filter-namespaces"
              options={namespaceOptions}
              value={field.value}
              isClearable
              createCustomValue
              loading={namespaces.loading}
              disabled={namespaces.loading}
              placeholder={t('home.solutions.kubernetes.filter.all-namespaces', 'All namespaces')}
              onChange={(options) => field.onChange(options.map((o) => o.value))}
            />
          )}
        />
      </Field>
      <Field label={t('home.solutions.kubernetes.filter.nodes', 'Nodes')} htmlFor="kubernetes-filter-nodes" noMargin>
        <Controller
          control={control}
          name="nodes"
          render={({ field }) => (
            <MultiCombobox<string>
              id="kubernetes-filter-nodes"
              options={nodeOptions}
              value={field.value}
              isClearable
              createCustomValue
              loading={nodes.loading}
              disabled={nodes.loading}
              placeholder={t('home.solutions.kubernetes.filter.all-nodes', 'All nodes')}
              onChange={(options) => field.onChange(options.map((o) => o.value))}
            />
          )}
        />
      </Field>
    </>
  );
}

function toOptions(values: string[] | undefined): Array<ComboboxOption<string>> {
  return (values ?? []).map((value) => ({ label: value, value }));
}
