import { useState } from 'react';
import { useAsync } from 'react-use';

import { type DataSourceInstanceListItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Alert, Badge, Button, Combobox, Field, IconButton, Modal, MultiCombobox, Stack } from '@grafana/ui';

import { fetchKubernetesFilterOptions } from './kubernetesData';
import { hasKubernetesFilters, type KubernetesHomeFilters, useKubernetesFilters } from './kubernetesFilters';

interface KubernetesFiltersButtonProps {
  datasource: DataSourceInstanceListItem;
}

export function KubernetesFiltersButton({ datasource }: KubernetesFiltersButtonProps) {
  const [filters, saveFilters] = useKubernetesFilters();
  const [open, setOpen] = useState(false);
  const active = hasKubernetesFilters(filters);

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
      {open && (
        <KubernetesFiltersModal
          datasource={datasource}
          initial={filters}
          onSave={(next) => {
            saveFilters(next);
            setOpen(false);
          }}
          onDismiss={() => setOpen(false)}
        />
      )}
    </>
  );
}

interface KubernetesFiltersModalProps {
  datasource: DataSourceInstanceListItem;
  initial: KubernetesHomeFilters;
  onSave: (filters: KubernetesHomeFilters) => void;
  onDismiss: () => void;
}

function KubernetesFiltersModal({ datasource, initial, onSave, onDismiss }: KubernetesFiltersModalProps) {
  const [cluster, setCluster] = useState(initial.cluster ?? '');
  const [namespaces, setNamespaces] = useState(initial.namespaces ?? []);
  const [nodes, setNodes] = useState(initial.nodes ?? []);
  // Options load independently; a slow or failing datasource must not block the form.
  const { value: options, loading: optionsLoading } = useAsync(
    () => fetchKubernetesFilterOptions(datasource),
    [datasource]
  );
  const optionsFailed =
    options !== undefined && (options.clusters === null || options.namespaces === null || options.nodes === null);

  return (
    <Modal
      isOpen
      title={t('home.solutions.kubernetes.filters.customize', 'Customize Kubernetes monitoring')}
      onDismiss={onDismiss}
    >
      <Stack direction="column" gap={2}>
        {optionsFailed && (
          <Alert
            severity="warning"
            title={t(
              'home.solutions.kubernetes.filters.options-error',
              'Could not load some options from {{name}}. Type values manually.',
              { name: datasource.name }
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
            loading={optionsLoading}
            createCustomValue
          />
        </Field>
        <Field
          noMargin
          label={t('home.solutions.kubernetes.filters.nodes-label', 'Nodes')}
          description={t(
            'home.solutions.kubernetes.filters.nodes-description',
            'Pod health counts pods running on the selected nodes; alerts count only when labeled with a selected node.'
          )}
        >
          <MultiCombobox<string>
            options={(options?.nodes ?? []).map((value) => ({ value }))}
            value={nodes}
            onChange={(items) => setNodes(items.map((item) => item.value))}
            placeholder={t('home.solutions.kubernetes.filters.all-nodes', 'All nodes')}
            loading={optionsLoading}
            createCustomValue
          />
        </Field>
      </Stack>
      <Modal.ButtonRow>
        {hasKubernetesFilters(initial) && (
          <Button variant="secondary" fill="text" onClick={() => onSave({})}>
            {t('home.solutions.kubernetes.filters.clear', 'Clear filters')}
          </Button>
        )}
        <Button variant="secondary" fill="outline" onClick={onDismiss}>
          {t('home.solutions.kubernetes.filters.cancel', 'Cancel')}
        </Button>
        <Button onClick={() => onSave({ cluster: cluster || undefined, namespaces, nodes })}>
          {t('home.solutions.kubernetes.filters.save', 'Save')}
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
}
