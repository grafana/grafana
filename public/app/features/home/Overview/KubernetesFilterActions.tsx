import { css } from '@emotion/css';
import { useMemo, useState } from 'react';
import { useAsync } from 'react-use';

import { type DataSourceInstanceListItem, type GrafanaTheme2, store } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import {
  Alert,
  Badge,
  Button,
  Combobox,
  type ComboboxOption,
  Field,
  IconButton,
  Modal,
  MultiCombobox,
  Stack,
  useStyles2,
} from '@grafana/ui';
import { useStoredString } from 'app/core/hooks/useStored';

import { ctaClicked, solutionFilterChanged } from '../analytics/main';
import { type SolutionFilterChanged } from '../analytics/types';
import { hasSelection, type KubernetesScope } from '../solutions/kubernetesData';
import {
  fetchKubernetesLabelValues,
  type KubernetesFilter,
  kubernetesFilterStorageKey,
  parseKubernetesFilter,
  summarizeKubernetesFilter,
} from '../solutions/kubernetesFilter';

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

interface KubernetesFilterActionsProps {
  /** Datasource the card reads; a filter saved for another one is shown as not applied. */
  datasource: DataSourceInstanceListItem;
  /** Whether the card's action is the attention one, so the applied gear takes the same text color. */
  attention: boolean;
}

export function KubernetesFilterActions({ datasource, attention }: KubernetesFilterActionsProps) {
  const styles = useStyles2(getStyles, attention);
  const [raw] = useStoredString(kubernetesFilterStorageKey(), '');
  const filter = useMemo(() => parseKubernetesFilter(raw), [raw]);
  const applied = filter !== null && filter.datasourceUid === datasource.uid;
  const [open, setOpen] = useState(false);

  return (
    <>
      {filter && !applied && (
        <Badge
          color="darkgrey"
          icon="info-circle"
          text={t('home.solutions.kubernetes.filter.badge-ignored', 'Filters not applied')}
          tooltip={t(
            'home.solutions.kubernetes.filter.ignored-tooltip',
            'Saved for {{saved}}. This card reads {{current}}, so it shows the whole fleet.',
            { saved: filter.datasourceName, current: datasource.name, interpolation: { escapeValue: false } }
          )}
        />
      )}
      {/* The highlighted gear is the only sign a filter is applied, so its tooltip carries the selection. */}
      <IconButton
        name="cog"
        tooltip={
          applied
            ? t('home.solutions.kubernetes.filter.edit', 'Edit filters ({{summary}})', {
                summary: summarizeKubernetesFilter(filter),
                interpolation: { escapeValue: false },
              })
            : t('home.solutions.kubernetes.filter.open', 'Filter by cluster, namespace, or node')
        }
        className={applied ? styles.applied : undefined}
        onClick={() => {
          setOpen(true);
          ctaClicked({
            surface: 'overview',
            action: 'open_solution_filter',
            placement: 'card',
            solution: 'kubernetes',
          });
        }}
      />
      {open && <KubernetesFilterModal datasource={datasource} filter={filter} onClose={() => setOpen(false)} />}
    </>
  );
}

interface KubernetesFilterModalProps {
  datasource: DataSourceInstanceListItem;
  filter: KubernetesFilter | null;
  onClose: () => void;
}

// Mounted only while open, so the draft starts from the stored filter each time.
function KubernetesFilterModal({ datasource, filter, onClose }: KubernetesFilterModalProps) {
  // The draft starts from the stored filter even when it was saved for another datasource, so the
  // user can re-save it for this one or clear it.
  const [draft, setDraft] = useState<KubernetesScope>(() =>
    filter ? { cluster: filter.cluster, namespaces: filter.namespaces, nodes: filter.nodes } : NO_SCOPE
  );
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

  const storageKey = kubernetesFilterStorageKey();
  const [error, setError] = useState<string | null>(null);
  // Persist, report, then close; a quota or access failure keeps the dialog and draft so the user
  // can retry, and reports nothing.
  const persist = (write: () => void, change: SolutionFilterChanged['change'], scope: KubernetesScope) => {
    try {
      write();
    } catch {
      setError(t('home.solutions.kubernetes.filter.save-failed', 'Could not save to browser storage. Try again.'));
      return;
    }
    solutionFilterChanged({ solution: 'kubernetes', change, customized: customizedDimensions(scope) });
    onClose();
  };
  const save = () =>
    persist(
      () => {
        const next: KubernetesFilter = { datasourceUid: datasource.uid, datasourceName: datasource.name, ...draft };
        store.setObject(storageKey, next);
      },
      'saved',
      draft
    );
  const clear = () => persist(() => store.delete(storageKey), 'cleared', NO_SCOPE);

  return (
    <Modal
      isOpen
      title={t('home.solutions.kubernetes.filter.title', 'Filter Kubernetes Monitoring')}
      onDismiss={onClose}
    >
      <Stack direction="column" gap={2}>
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
            onChange={(option) => setDraft({ ...draft, cluster: option?.value ?? '' })}
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
            onChange={(options) => setDraft({ ...draft, namespaces: options.map((o) => o.value) })}
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
            onChange={(options) => setDraft({ ...draft, nodes: options.map((o) => o.value) })}
          />
        </Field>
        {error && <Alert severity="error" title={error} />}
      </Stack>
      <Modal.ButtonRow
        leftItems={
          filter && (
            <Button variant="secondary" fill="outline" onClick={clear}>
              <Trans i18nKey="home.solutions.kubernetes.filter.clear">Clear filters</Trans>
            </Button>
          )
        }
      >
        <Button variant="secondary" onClick={onClose}>
          <Trans i18nKey="home.solutions.kubernetes.filter.cancel">Cancel</Trans>
        </Button>
        <Button onClick={save} disabled={!hasSelection(draft)}>
          <Trans i18nKey="home.solutions.kubernetes.filter.save">Save</Trans>
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
}

function toOptions(values: string[] | undefined): Array<ComboboxOption<string>> {
  return (values ?? []).map((value) => ({ label: value, value }));
}

const getStyles = (theme: GrafanaTheme2, attention: boolean) => ({
  applied: css({
    // The card's text-fill action is accent-colored, or warning-colored when it points at alerts;
    // `&&` outranks IconButton's own color.
    '&&': {
      color: attention ? theme.colors.warning.text : theme.colors.accent.text,
    },
  }),
});
