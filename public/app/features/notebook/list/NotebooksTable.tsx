import { useMemo } from 'react';

import { dateTimeFormat, dateTimeFormatTimeAgo } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  ClipboardButton,
  type Column,
  IconButton,
  InteractiveTable,
  LinkButton,
  Stack,
  TagList,
  TextLink,
  Tooltip,
} from '@grafana/ui';

import { notebookViewUrl } from '../urls';

import { type NotebookRow } from './useNotebooksList';

interface Props {
  notebooks: NotebookRow[];
}

export function NotebooksTable({ notebooks }: Props) {
  const columns: Array<Column<NotebookRow>> = useMemo(
    () => [
      {
        id: 'title',
        header: t('notebooks.list.table.title', 'Title'),
        sortType: 'string',
        cell: ({ row: { original } }) => (
          <TextLink color="primary" inline={false} href={notebookViewUrl(original.uid)} title={original.title}>
            {original.title}
          </TextLink>
        ),
      },
      {
        id: 'authorName',
        header: t('notebooks.list.table.author', 'Author'),
        sortType: 'string',
      },
      {
        id: 'tags',
        header: t('notebooks.list.table.tags', 'Tags'),
        cell: ({ row: { original } }) => <TagList tags={original.tags} displayMax={3} />,
      },
      {
        id: 'created',
        header: t('notebooks.list.table.created', 'Created'),
        sortType: 'string',
        disableGrow: true,
        cell: ({ row: { original } }) => <RelativeTime timestamp={original.created} />,
      },
      {
        id: 'updated',
        header: t('notebooks.list.table.updated', 'Updated'),
        sortType: 'string',
        disableGrow: true,
        cell: ({ row: { original } }) => <RelativeTime timestamp={original.updated} />,
      },
      {
        id: 'actions',
        header: '',
        disableGrow: true,
        cell: ({ row: { original } }) => <NotebookRowActions notebook={original} />,
      },
    ],
    []
  );

  return (
    <InteractiveTable
      columns={columns}
      data={notebooks}
      getRowId={(notebook) => notebook.uid}
      initialSortBy={[{ id: 'updated', desc: true }]}
    />
  );
}

function RelativeTime({ timestamp }: { timestamp: string }) {
  if (!timestamp) {
    return null;
  }

  return (
    <Tooltip content={dateTimeFormat(timestamp)}>
      <span>{dateTimeFormatTimeAgo(timestamp)}</span>
    </Tooltip>
  );
}

function NotebookRowActions({ notebook }: { notebook: NotebookRow }) {
  const href = notebookViewUrl(notebook.uid);

  return (
    <Stack alignItems="center" justifyContent="flex-end" gap={1}>
      {/* Editing is not built yet, so Edit goes where the title goes: the notebook itself. */}
      <LinkButton variant="secondary" size="sm" icon="pen" href={href}>
        {t('notebooks.list.table.edit', 'Edit')}
      </LinkButton>
      <ClipboardButton
        variant="secondary"
        size="sm"
        icon="link"
        getText={() => new URL(href, window.location.origin).toString()}
      >
        {t('notebooks.list.table.copy-link', 'Copy link')}
      </ClipboardButton>
      {/* Row-level actions land in a follow-up; the menu is a disabled placeholder for now. */}
      <IconButton
        name="ellipsis-v"
        disabled
        aria-label={t('notebooks.list.table.more-actions', 'More actions')}
        tooltip={t('notebooks.list.table.more-actions', 'More actions')}
      />
    </Stack>
  );
}
