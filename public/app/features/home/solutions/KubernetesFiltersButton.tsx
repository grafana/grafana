import { useState } from 'react';
import { useAsyncFn } from 'react-use';

import { type DataSourceInstanceListItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Alert, Badge, Button, Combobox, Field, IconButton, Modal, MultiCombobox, Stack } from '@grafana/ui';

import { fetchKubernetesFilterOptions, type KubernetesFilterOptions } from './kubernetesData';
import {
  hasKubernetesFilters,
  type KubernetesFilterValues,
  kubernetesFilterValuesFor,
  useKubernetesFilterSelection,
} from './kubernetesFilters';

interface KubernetesFiltersButtonProps {
  datasource: DataSourceInstanceListItem;
}

// null = that picker's discovery failed; manual entry still works.
const optionsIncomplete = (o: KubernetesFilterOptions) =>
  o.clusters === null || o.namespaces === null || o.nodes === null;

export function KubernetesFiltersButton({ datasource }: KubernetesFiltersButtonProps) {
  const [selection, saveSelection] = useKubernetesFilterSelection();
  const [open, setOpen] = useState(false);
  // A selection scopes only the datasource it came from; resolved to another, the card runs
  // unscoped and says so, and the modal starts empty rather than seeding foreign values.
  const values = kubernetesFilterValuesFor(selection, datasource.uid);
  const active = hasKubernetesFilters(values);
  const notApplied = !active && selection !== null;
  // Loaded on the first open and kept for the card's lifetime, so reopening costs no queries;
  // a load that left a picker empty is retried on the next open.
  const [{ value: options, loading: optionsLoading }, loadOptions] = useAsyncFn(
    () => fetchKubernetesFilterOptions(datasource),
    [datasource]
  );
  const openModal = () => {
    if (!optionsLoading && (options === undefined || optionsIncomplete(options))) {
      loadOptions();
    }
    setOpen(true);
  };

  return (
    <>
      <Stack direction="row" gap={1} alignItems="center">
        {active && <Badge text={t('home.solutions.kubernetes.filters.filtered-badge', 'Filtered')} color="blue" />}
        {notApplied && (
          <Badge
            text={t('home.solutions.kubernetes.filters.not-applied-badge', 'Filters not applied')}
            color="orange"
            tooltip={t(
              'home.solutions.kubernetes.filters.not-applied-tooltip',
              'The saved filters belong to another datasource. Save new filters for {{name}} or clear them.',
              { name: datasource.name }
            )}
          />
        )}
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
          onClick={openModal}
        />
      </Stack>
      {/* Mounted only while open so every open starts from the persisted filters. */}
      {open && (
        <KubernetesFiltersModal
          datasource={datasource}
          options={options}
          optionsLoading={optionsLoading}
          initial={values}
          canClear={selection !== null}
          onSave={(next) => {
            // No values left is a clear: the selection stores as nothing.
            saveSelection({ datasourceUid: datasource.uid, values: next });
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
  options: KubernetesFilterOptions | undefined;
  optionsLoading: boolean;
  initial: KubernetesFilterValues;
  /** A selection is saved, for this datasource or another. */
  canClear: boolean;
  onSave: (values: KubernetesFilterValues) => void;
  onDismiss: () => void;
}

function KubernetesFiltersModal({
  datasource,
  options,
  optionsLoading,
  initial,
  canClear,
  onSave,
  onDismiss,
}: KubernetesFiltersModalProps) {
  const [cluster, setCluster] = useState(initial.cluster ?? '');
  const [namespaces, setNamespaces] = useState(initial.namespaces ?? []);
  const [nodes, setNodes] = useState(initial.nodes ?? []);
  // A retry keeps the previous options while loading; the warning waits for its verdict.
  const optionsFailed = !optionsLoading && options !== undefined && optionsIncomplete(options);

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
        {canClear && (
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
