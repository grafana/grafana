import { useCallback, useEffect, useState } from 'react';

import { dateTimeFormat, dateTimeFormatTimeAgo } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import {
  Button,
  type Column,
  ConfirmModal,
  EmptyState,
  InteractiveTable,
  LoadingPlaceholder,
  Stack,
  TextLink,
} from '@grafana/ui';
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

  const columns: Array<Column<DraftListItem>> = [
    {
      id: 'title',
      header: t('dashboard-scene.lifecycle.drafts-column-title', 'Title'),
      cell: ({ row: { original } }) => (
        <TextLink href={`/d/${original.uid}`} inline={false}>
          {original.title}
        </TextLink>
      ),
    },
    {
      id: 'created',
      header: t('dashboard-scene.lifecycle.drafts-column-created', 'Created'),
      cell: ({ row: { original } }) => <DraftTime value={original.created} />,
      sortType: (a, b) => (a.original.created ?? 0) - (b.original.created ?? 0),
    },
    {
      id: 'updated',
      header: t('dashboard-scene.lifecycle.drafts-column-updated', 'Updated'),
      cell: ({ row: { original } }) => <DraftTime value={original.updated} />,
      sortType: (a, b) => (a.original.updated ?? 0) - (b.original.updated ?? 0),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row: { original } }) => (
        <Stack justifyContent="flex-end">
          <Button variant="destructive" fill="text" size="sm" icon="trash-alt" onClick={() => setDiscarding(original)}>
            <Trans i18nKey="dashboard-scene.lifecycle.discard">Discard</Trans>
          </Button>
        </Stack>
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

/** How long ago, with the exact time on hover. */
function DraftTime({ value }: { value: number | undefined }) {
  return value === undefined ? null : <span title={dateTimeFormat(value)}>{dateTimeFormatTimeAgo(value)}</span>;
}
