import { useMemo, useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import {
  Alert,
  Badge,
  Button,
  type Column,
  ConfirmModal,
  EmptyState,
  InteractiveTable,
  LinkButton,
  LoadingPlaceholder,
  Stack,
  Text,
} from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { useDeleteHookMutation, useListHooksQuery } from '../api/pulseApi';
import { type PulseHook } from '../types';
import { pulseErrorMessage } from '../utils/errors';

/**
 * PulseHooksListPage is the Administration surface for named Pulse
 * hooks (outbound webhook integrations). It mirrors the data-source /
 * contact-point list pattern: a table of configured hooks with create,
 * edit, and delete affordances. Gated behind pulse:admin (route role
 * check) and the dashboardPulse feature toggle (route registration).
 */
export default function PulseHooksListPage() {
  const { data, isLoading, isError, error } = useListHooksQuery();
  const [deleteHook] = useDeleteHookMutation();
  const [pendingDelete, setPendingDelete] = useState<PulseHook | null>(null);

  const hooks = useMemo(() => data?.hooks ?? [], [data]);

  const columns: Array<Column<PulseHook>> = useMemo(
    () => [
      {
        id: 'name',
        header: t('pulse.hooks.col-name', 'Name'),
        cell: ({ row: { original } }) => (
          <Stack direction="row" gap={1} alignItems="center">
            <LinkButton fill="text" href={`/admin/pulse/edit/${encodeURIComponent(original.uid)}`}>
              {original.name}
            </LinkButton>
            {original.disabled && <Badge text={t('pulse.hooks.disabled-badge', 'Disabled')} color="orange" />}
          </Stack>
        ),
      },
      {
        id: 'type',
        header: t('pulse.hooks.col-type', 'Type'),
        cell: ({ row: { original } }) => <Text>{original.type}</Text>,
      },
      {
        id: 'url',
        header: t('pulse.hooks.col-url', 'URL'),
        cell: ({ row: { original } }) => (
          <Text variant="bodySmall" color="secondary">
            {original.url}
          </Text>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row: { original } }) => (
          <Stack direction="row" gap={1} justifyContent="flex-end">
            <LinkButton
              size="sm"
              variant="secondary"
              icon="pen"
              href={`/admin/pulse/edit/${encodeURIComponent(original.uid)}`}
              aria-label={t('pulse.hooks.edit-aria', 'Edit hook {{name}}', { name: original.name })}
            >
              <Trans i18nKey="pulse.hooks.edit">Edit</Trans>
            </LinkButton>
            <Button
              size="sm"
              variant="destructive"
              icon="trash-alt"
              onClick={() => setPendingDelete(original)}
              aria-label={t('pulse.hooks.delete-aria', 'Delete hook {{name}}', { name: original.name })}
            >
              <Trans i18nKey="pulse.hooks.delete">Delete</Trans>
            </Button>
          </Stack>
        ),
      },
    ],
    []
  );

  async function confirmDelete() {
    if (!pendingDelete) {
      return;
    }
    await deleteHook(pendingDelete.uid);
    setPendingDelete(null);
  }

  return (
    <Page
      navId="pulse-hooks"
      subTitle={t(
        'pulse.hooks.subtitle',
        'Named webhooks triggered when a Pulse mentions them. Mention a hook with @ in any thread to fire it.'
      )}
      actions={
        <LinkButton icon="plus" href="/admin/pulse/new">
          <Trans i18nKey="pulse.hooks.new">New hook</Trans>
        </LinkButton>
      }
    >
      <Page.Contents>
        {isLoading && <LoadingPlaceholder text={t('pulse.hooks.loading', 'Loading hooks…')} />}

        {isError && (
          <Alert title={t('pulse.hooks.load-error', 'Could not load Pulse hooks')} severity="error">
            {pulseErrorMessage(error) ?? ''}
          </Alert>
        )}

        {!isLoading && !isError && hooks.length === 0 && (
          <EmptyState
            variant="call-to-action"
            message={t('pulse.hooks.empty-title', "You haven't created any Pulse hooks yet")}
            button={
              <LinkButton icon="plus" href="/admin/pulse/new" size="lg">
                <Trans i18nKey="pulse.hooks.empty-cta">Create a hook</Trans>
              </LinkButton>
            }
          >
            <Trans i18nKey="pulse.hooks.empty-body">
              A hook posts a standardized JSON payload to a URL you control whenever a Pulse mentions it — perfect for
              an automation that replies on the thread.
            </Trans>
          </EmptyState>
        )}

        {!isLoading && !isError && hooks.length > 0 && (
          <InteractiveTable columns={columns} data={hooks} getRowId={(h) => h.uid} />
        )}

        {pendingDelete && (
          <ConfirmModal
            isOpen
            title={t('pulse.hooks.delete-title', 'Delete Pulse hook')}
            body={t(
              'pulse.hooks.delete-body',
              'Delete "{{name}}"? Existing mentions of this hook will stop firing. This cannot be undone.',
              { name: pendingDelete.name }
            )}
            confirmText={t('pulse.hooks.delete-confirm', 'Delete')}
            onConfirm={confirmDelete}
            onDismiss={() => setPendingDelete(null)}
          />
        )}
      </Page.Contents>
    </Page>
  );
}
