import { useCallback, useEffect, useState } from 'react';

import { t, Trans } from '@grafana/i18n';
import { Button, ConfirmModal, EmptyState, InteractiveTable, LoadingPlaceholder, TextLink } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { discardDashboard, type DraftListItem, listMyDrafts } from './lifecycleApi';

/** The signed-in user's drafts: the dashboards only they can see. */
export default function DashboardDraftsPage() {
  const [drafts, setDrafts] = useState<DraftListItem[] | undefined>(undefined);
  const [error, setError] = useState(false);
  const [discarding, setDiscarding] = useState<DraftListItem | undefined>(undefined);

  const load = useCallback(() => {
    setError(false);
    listMyDrafts()
      .then(setDrafts)
      .catch(() => setError(true));
  }, []);

  useEffect(load, [load]);

  const columns = [
    {
      id: 'title',
      header: t('dashboard-scene.lifecycle.drafts-column-title', 'Title'),
      cell: ({ row: { original } }: { row: { original: DraftListItem } }) => (
        <TextLink href={`/d/${original.uid}`} inline={false}>
          {original.title}
        </TextLink>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row: { original } }: { row: { original: DraftListItem } }) => (
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
          <EmptyState
            variant="call-to-action"
            message={t('dashboard-scene.lifecycle.drafts-error', "Couldn't load your drafts")}
          >
            <Button onClick={load}>
              <Trans i18nKey="dashboard-scene.lifecycle.retry">Retry</Trans>
            </Button>
          </EmptyState>
        ) : drafts === undefined ? (
          <LoadingPlaceholder text={t('dashboard-scene.lifecycle.drafts-loading', 'Loading drafts…')} />
        ) : drafts.length === 0 ? (
          <EmptyState variant="completed" message={t('dashboard-scene.lifecycle.drafts-empty', 'You have no drafts')}>
            <Trans i18nKey="dashboard-scene.lifecycle.drafts-empty-body">
              Drafts are created when Grafana Assistant builds a dashboard for you.
            </Trans>
          </EmptyState>
        ) : (
          <InteractiveTable columns={columns} data={drafts} getRowId={(row) => row.uid} />
        )}
        {discarding && (
          <ConfirmModal
            isOpen
            title={t('dashboard-scene.lifecycle.discard-named-title', 'Discard “{{title}}”?', {
              title: discarding.title,
            })}
            body={t('dashboard-scene.lifecycle.discard-draft-generic', 'It moves to Recently deleted.')}
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
