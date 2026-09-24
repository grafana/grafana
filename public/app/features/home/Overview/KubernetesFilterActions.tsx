import { useMemo } from 'react';
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
  return [scope.cluster && 'cluster', scope.namespaces.length && 'namespaces', scope.nodes.length && 'nodes']
    .filter(Boolean)
    .join(',');
}

const spec: SolutionFilterSpec<KubernetesScope> = {
  solution: 'kubernetes',
  parse: parseKubernetesFilter,
  summarize: summarizeKubernetesFilter,
  emptyScope: NO_SCOPE,
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
      {(draft, onChange) => <KubernetesFilterFields datasource={datasource} draft={draft} onChange={onChange} />}
    </SolutionFilterActions>
  );
}

interface KubernetesFilterFieldsProps {
  datasource: DataSourceInstanceListItem;
  draft: KubernetesScope;
  onChange: (scope: KubernetesScope) => void;
}

function KubernetesFilterFields({ datasource, draft, onChange }: KubernetesFilterFieldsProps) {
  const clusters = useAsync(() => fetchKubernetesLabelValues(datasource.uid, 'cluster', ''), [datasource.uid]);
  // Namespace and node lists follow the drafted cluster ('' = every cluster).
  const namespaces = useAsync(
    () => fetchKubernetesLabelValues(datasource.uid, 'namespace', draft.cluster),
    [datasource.uid, draft.cluster]
  );
  const nodes = useAsync(
    () => fetchKubernetesLabelValues(datasource.uid, 'node', draft.cluster),
    [datasource.uid, draft.cluster]
  );
  // A rejected lookup leaves the value undefined: an empty list, with custom entry still allowed.
  const clusterOptions = useMemo(() => toOptions(clusters.value), [clusters.value]);
  const namespaceOptions = useMemo(() => toOptions(namespaces.value), [namespaces.value]);
  const nodeOptions = useMemo(() => toOptions(nodes.value), [nodes.value]);

  return (
    <>
      {/* Each select is locked until its own values arrive; the namespace and node lists reload per cluster. */}
      <Field label={t('home.solutions.kubernetes.filter.cluster', 'Cluster')} noMargin>
        <Combobox<string>
          id="kubernetes-filter-cluster"
          options={clusterOptions}
          value={draft.cluster || null}
          isClearable
          createCustomValue
          loading={clusters.loading}
          disabled={clusters.loading}
          placeholder={t('home.solutions.kubernetes.filter.all-clusters', 'All clusters')}
          onChange={(option) => onChange({ ...draft, cluster: option?.value ?? '' })}
        />
      </Field>
      <Field label={t('home.solutions.kubernetes.filter.namespaces', 'Namespaces')} noMargin>
        <MultiCombobox<string>
          id="kubernetes-filter-namespaces"
          options={namespaceOptions}
          value={draft.namespaces}
          isClearable
          createCustomValue
          loading={namespaces.loading}
          disabled={namespaces.loading}
          placeholder={t('home.solutions.kubernetes.filter.all-namespaces', 'All namespaces')}
          onChange={(options) => onChange({ ...draft, namespaces: options.map((o) => o.value) })}
        />
      </Field>
      <Field label={t('home.solutions.kubernetes.filter.nodes', 'Nodes')} noMargin>
        <MultiCombobox<string>
          id="kubernetes-filter-nodes"
          options={nodeOptions}
          value={draft.nodes}
          isClearable
          createCustomValue
          loading={nodes.loading}
          disabled={nodes.loading}
          placeholder={t('home.solutions.kubernetes.filter.all-nodes', 'All nodes')}
          onChange={(options) => onChange({ ...draft, nodes: options.map((o) => o.value) })}
        />
      </Field>
    </>
  );
}

function toOptions(values: string[] | undefined): Array<ComboboxOption<string>> {
  return (values ?? []).map((value) => ({ label: value, value }));
}
