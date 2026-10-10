import { useCallback, useEffect, useState } from 'react';

import { t, Trans } from '@grafana/i18n';
import { Badge, Button, ConfirmModal, EmptyState, InteractiveTable, LoadingPlaceholder, TextLink } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { discardDashboard, type LifecycleListItem, listMyDraftsAndForks } from './lifecycleApi';

/** The signed-in user's drafts and forks: the dashboards only they can see. */
export default function DashboardDraftsPage() {
  const [items, setItems] = useState<LifecycleListItem[] | undefined>(undefined);
  const [error, setError] = useState(false);
  const [discarding, setDiscarding] = useState<LifecycleListItem | undefined>(undefined);

  const load = useCallback(() => {
    setError(false);
    listMyDraftsAndForks()
      .then(setItems)
      .catch(() => setError(true));
  }, []);

  useEffect(load, [load]);

  const columns = [
    {
      id: 'title',
      header: t('dashboard-scene.lifecycle.drafts-column-title', 'Title'),
      cell: ({ row: { original } }: { row: { original: LifecycleListItem } }) => (
        <TextLink href={`/d/${original.uid}`} inline={false}>
          {original.title}
        </TextLink>
      ),
    },
    {
      id: 'type',
      header: t('dashboard-scene.lifecycle.drafts-column-type', 'Type'),
      cell: ({ row: { original } }: { row: { original: LifecycleListItem } }) =>
        original.lifecycle === 'fork' ? (
          <Badge text={t('dashboard-scene.lifecycle.breadcrumb-fork', 'Fork')} color="blue" />
        ) : (
          <Badge text={t('dashboard-scene.lifecycle.breadcrumb-draft', 'Draft')} color="orange" />
        ),
    },
    {
      id: 'forkOf',
      header: t('dashboard-scene.lifecycle.drafts-column-original', 'Original'),
      cell: ({ row: { original } }: { row: { original: LifecycleListItem } }) =>
        original.forkOf ? (
          <TextLink href={`/d/${original.forkOf}`} inline={false}>
            {t('dashboard-scene.lifecycle.open-original', 'Open original')}
          </TextLink>
        ) : null,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row: { original } }: { row: { original: LifecycleListItem } }) => (
        <Button variant="destructive" fill="text" size="sm" icon="trash-alt" onClick={() => setDiscarding(original)}>
          <Trans i18nKey="dashboard-scene.lifecycle.discard">Discard</Trans>
        </Button>
      ),
    },
  ];

  return (
    <Page navId="dashboards/drafts">
      <Page.Contents>
        {error ? (
          <EmptyState variant="call-to-action" message={t('dashboard-scene.lifecycle.drafts-error', "Couldn't load your drafts")}>
            <Button onClick={load}>
              <Trans i18nKey="dashboard-scene.lifecycle.retry">Retry</Trans>
            </Button>
          </EmptyState>
        ) : items === undefined ? (
          <LoadingPlaceholder text={t('dashboard-scene.lifecycle.drafts-loading', 'Loading drafts…')} />
        ) : items.length === 0 ? (
          <EmptyState variant="completed" message={t('dashboard-scene.lifecycle.drafts-empty', 'You have no drafts or forks')}>
            <Trans i18nKey="dashboard-scene.lifecycle.drafts-empty-body">
              Drafts and forks are created when Grafana Assistant builds or changes a dashboard for you.
            </Trans>
          </EmptyState>
        ) : (
          <InteractiveTable columns={columns} data={items} getRowId={(item) => item.uid} />
        )}
        {discarding && (
          <ConfirmModal
            isOpen
            title={t('dashboard-scene.lifecycle.discard-named-title', 'Discard “{{title}}”?', { title: discarding.title })}
            body={t('dashboard-scene.lifecycle.discard-fork-body-generic', 'It moves to Recently deleted.')}
            confirmText={t('dashboard-scene.lifecycle.discard', 'Discard')}
            onDismiss={() => setDiscarding(undefined)}
            onConfirm={async () => {
              await discardDashboard(discarding.uid);
              setDiscarding(undefined);
              load();
            }}
          />
        )}
      </Page.Contents>
    </Page>
  );
}
