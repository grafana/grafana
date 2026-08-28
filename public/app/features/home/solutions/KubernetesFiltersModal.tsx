import { useState, useSyncExternalStore } from 'react';
import { useAsync } from 'react-use';

import { type DataSourceInstanceListItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  Alert,
  Badge,
  Button,
  Combobox,
  Field,
  IconButton,
  LoadingPlaceholder,
  Modal,
  MultiCombobox,
  Stack,
} from '@grafana/ui';

import { fetchKubernetesFilterOptions, type KubernetesFilterOptions } from './kubernetesData';
import {
  getKubernetesFilters,
  getKubernetesFiltersVersion,
  saveKubernetesFilters,
  subscribeKubernetesFilters,
  type KubernetesHomeFilters,
} from './kubernetesFilters';

interface KubernetesFiltersButtonProps {
  datasource: DataSourceInstanceListItem;
}

export function KubernetesFiltersButton({ datasource }: KubernetesFiltersButtonProps) {
  const version = useSyncExternalStore(subscribeKubernetesFilters, getKubernetesFiltersVersion);
  const { value: filters } = useAsync(getKubernetesFilters, [version]);
  const [open, setOpen] = useState(false);
  const active = Boolean(filters?.cluster || filters?.namespaces?.length || filters?.nodes?.length);

  return (
    <>
      <Stack direction="row" gap={1} alignItems="center">
        {active && <Badge text={t('home.solutions.kubernetes.filters.filtered-badge', 'Filtered')} color="blue" />}
        <IconButton
          name="cog"
          tooltip={
            active
              ? t(
                  'home.solutions.kubernetes.filters.customize-active',
                  'Customize Kubernetes monitoring (filters active)'
                )
              : t('home.solutions.kubernetes.filters.customize', 'Customize Kubernetes monitoring')
          }
          onClick={() => setOpen(true)}
        />
      </Stack>
      {/* Mounted only while open so every open starts from the persisted filters. */}
      {open && <KubernetesFiltersModal datasource={datasource} onDismiss={() => setOpen(false)} />}
    </>
  );
}

interface KubernetesFiltersModalProps {
  datasource: DataSourceInstanceListItem;
  onDismiss: () => void;
}

function KubernetesFiltersModal({ datasource, onDismiss }: KubernetesFiltersModalProps) {
  const { value: initial } = useAsync(getKubernetesFilters, []);
  // Options load independently; a slow or failing datasource must not block the form.
  const { value: options, loading: optionsLoading } = useAsync(
    () => fetchKubernetesFilterOptions(datasource),
    [datasource]
  );

  return (
    <Modal
      isOpen
      title={t('home.solutions.kubernetes.filters.customize', 'Customize Kubernetes monitoring')}
      onDismiss={onDismiss}
    >
      {/* The form mounts only after the persisted read settles: its state initializers seed from
          `initial`, so there is no later effect that could clobber user edits. */}
      {initial === undefined ? (
        <LoadingPlaceholder text={t('home.solutions.kubernetes.filters.loading', 'Loading filters...')} />
      ) : (
        <FiltersForm
          datasourceName={datasource.name}
          initial={initial}
          options={options}
          optionsLoading={optionsLoading}
          onDismiss={onDismiss}
        />
      )}
    </Modal>
  );
}

interface FiltersFormProps {
  datasourceName: string;
  initial: KubernetesHomeFilters;
  options: KubernetesFilterOptions | undefined;
  optionsLoading: boolean;
  onDismiss: () => void;
}

function FiltersForm({ datasourceName, initial, options, optionsLoading, onDismiss }: FiltersFormProps) {
  const [cluster, setCluster] = useState(initial.cluster ?? '');
  const [namespaces, setNamespaces] = useState(initial.namespaces ?? []);
  const [nodes, setNodes] = useState(initial.nodes ?? []);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const save = async (filters: KubernetesHomeFilters) => {
    setSaving(true);
    setSaveError(false);
    try {
      await saveKubernetesFilters(filters);
      onDismiss();
    } catch {
      setSaveError(true);
      setSaving(false);
    }
  };

  const optionsFailed =
    options !== undefined && (options.clusters === null || options.namespaces === null || options.nodes === null);

  return (
    <>
      <Stack direction="column" gap={2}>
        {optionsFailed && (
          <Alert
            severity="warning"
            title={t(
              'home.solutions.kubernetes.filters.options-error',
              'Could not load some options from {{name}}. Type values manually.',
              { name: datasourceName }
            )}
          />
        )}
        <Field noMargin label={t('home.solutions.kubernetes.filters.cluster-label', 'Cluster')}>
          <Combobox<string>
            options={[
              { label: t('home.solutions.kubernetes.filters.all-clusters', 'All clusters'), value: '' },
              ...(options?.clusters ?? []).map((value) => ({ value })),
            ]}
            value={cluster}
            onChange={(option) => setCluster(option.value)}
            disabled={optionsLoading}
            loading={optionsLoading}
            createCustomValue
          />
        </Field>
        <Field
          noMargin
          label={t('home.solutions.kubernetes.filters.namespaces-label', 'Namespaces')}
          description={t(
            'home.solutions.kubernetes.filters.namespaces-description',
            'Health signals and alerts are scoped to the selected namespaces; the cluster count is not.'
          )}
        >
          <MultiCombobox<string>
            options={(options?.namespaces ?? []).map((value) => ({ value }))}
            value={namespaces}
            onChange={(items) => setNamespaces(items.map((item) => item.value))}
            placeholder={t('home.solutions.kubernetes.filters.all-namespaces', 'All namespaces')}
            disabled={optionsLoading}
            loading={optionsLoading}
            createCustomValue
          />
        </Field>
        <Field
          noMargin
          label={t('home.solutions.kubernetes.filters.nodes-label', 'Nodes')}
          description={t(
            'home.solutions.kubernetes.filters.nodes-description',
            'Pod health is attributed to nodes via kube_pod_info; only alerts labeled with a selected node are counted.'
          )}
        >
          <MultiCombobox<string>
            options={(options?.nodes ?? []).map((value) => ({ value }))}
            value={nodes}
            onChange={(items) => setNodes(items.map((item) => item.value))}
            placeholder={t('home.solutions.kubernetes.filters.all-nodes', 'All nodes')}
            disabled={optionsLoading}
            loading={optionsLoading}
            createCustomValue
          />
        </Field>
        {saveError && (
          <Alert
            severity="error"
            title={t('home.solutions.kubernetes.filters.save-error', 'Could not save filters. Try again.')}
          />
        )}
      </Stack>
      <Modal.ButtonRow>
        {Boolean(initial.cluster || initial.namespaces?.length || initial.nodes?.length) && (
          <Button variant="secondary" fill="text" disabled={saving} onClick={() => save({})}>
            {t('home.solutions.kubernetes.filters.clear', 'Clear filters')}
          </Button>
        )}
        <Button variant="secondary" fill="outline" disabled={saving} onClick={onDismiss}>
          {t('home.solutions.kubernetes.filters.cancel', 'Cancel')}
        </Button>
        <Button disabled={saving} onClick={() => save({ cluster: cluster || undefined, namespaces, nodes })}>
          {t('home.solutions.kubernetes.filters.save', 'Save')}
        </Button>
      </Modal.ButtonRow>
    </>
  );
}
