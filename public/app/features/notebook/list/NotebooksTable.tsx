import { css } from '@emotion/css';
import { useMemo } from 'react';

import { dateTimeFormat, dateTimeFormatTimeAgo } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  ClipboardButton,
  type Column,
  Dropdown,
  IconButton,
  InteractiveTable,
  LinkButton,
  Menu,
  Stack,
  TagList,
  TextLink,
  Tooltip,
  useStyles2,
} from '@grafana/ui';
import { useLazyGetNotebookQuery } from 'app/api/clients/dashboard/v2beta1';

import { NotebookExportMenu } from '../export/NotebookExportMenu';
import { canEditNotebooks } from '../permissions';
import { type Spec as NotebookSpec } from '../types';
import { notebookEditHref, notebookShareUrl, notebookViewUrl } from '../urls';

import { type NotebookRow } from './useNotebooksList';

interface Props {
  notebooks: NotebookRow[];
}

export function NotebooksTable({ notebooks }: Props) {
  const styles = useStyles2(getStyles);

  const columns: Array<Column<NotebookRow>> = useMemo(
    () => [
      {
        id: 'title',
        header: t('notebooks.list.table.title', 'Title'),
        sortType: 'string',
        // Capped so the title stops absorbing all the table's slack; tags take the remainder.
        width: 320,
        maxWidth: 320,
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
        width: 180,
      },
      {
        id: 'tags',
        header: t('notebooks.list.table.tags', 'Tags'),
        minWidth: 160,
        cell: ({ row: { original } }) => <TagList tags={original.tags} displayMax={3} className={styles.tagList} />,
      },
      {
        id: 'created',
        header: t('notebooks.list.table.created', 'Created'),
        sortType: 'string',
        disableGrow: true,
        width: 120,
        cell: ({ row: { original } }) => <RelativeTime timestamp={original.created} />,
      },
      {
        id: 'updated',
        header: t('notebooks.list.table.updated', 'Updated'),
        sortType: 'string',
        disableGrow: true,
        width: 120,
        cell: ({ row: { original } }) => <RelativeTime timestamp={original.updated} />,
      },
      {
        id: 'actions',
        header: '',
        disableGrow: true,
        cell: ({ row: { original } }) => <NotebookRowActions notebook={original} />,
      },
    ],
    // styles is memoized per theme, so this stays referentially stable and the table doesn't remount.
    [styles]
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
  const styles = useStyles2(getStyles);

  if (!timestamp) {
    return null;
  }

  return (
    <Tooltip content={dateTimeFormat(timestamp)}>
      <span className={styles.nowrap}>{dateTimeFormatTimeAgo(timestamp)}</span>
    </Tooltip>
  );
}

function NotebookRowActions({ notebook }: { notebook: NotebookRow }) {
  // Omitted rather than disabled for a user who cannot edit, matching the create button on the page
  // around this table.
  const canEdit = canEditNotebooks();

  return (
    <Stack alignItems="center" justifyContent="flex-end" gap={1}>
      {canEdit && (
        <LinkButton variant="secondary" size="sm" icon="pen" href={notebookEditHref(notebook.uid)}>
          {t('notebooks.list.table.edit', 'Edit')}
        </LinkButton>
      )}
      <ClipboardButton variant="secondary" size="sm" icon="link" getText={() => notebookShareUrl(notebook.uid)}>
        {t('notebooks.list.table.copy-link', 'Copy link')}
      </ClipboardButton>
      <Dropdown overlay={<NotebookRowMenu uid={notebook.uid} />} placement="bottom-end">
        <IconButton
          name="ellipsis-v"
          variant="secondary"
          aria-label={t('notebooks.list.table.more-actions', 'More actions')}
          tooltip={t('notebooks.list.table.more-actions', 'More actions')}
        />
      </Dropdown>
    </Stack>
  );
}

function NotebookRowMenu({ uid }: { uid: string }) {
  const [fetchNotebook] = useLazyGetNotebookQuery();

  return (
    <Menu>
      {/* A submenu for one top-level item reads a little oddly today, but it is the shape Duplicate
          and Delete slot into, and it matches the design. */}
      <Menu.Item
        label={t('notebooks.export.label', 'Export')}
        icon="download-alt"
        childItems={[
          <NotebookExportMenu
            key="export"
            uid={uid}
            // The table's rows are flattened and carry no spec, so it is fetched when an action runs
            // rather than for every row on screen.
            getSpec={async () => {
              const notebook = await fetchNotebook({ name: uid }).unwrap();
              // The generated client type mirrors the schema spec at runtime (same OpenAPI source);
              // bridge at the fetch seam, as the notebook page state manager does.
              // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- generated client type bridged to the schema spec at the fetch seam
              return notebook.spec as unknown as NotebookSpec;
            }}
          />,
        ]}
      />
    </Menu>
  );
}

// Module scope so useStyles2 can memoize — it keys its cache on the function's identity, so an
// inline arrow would rebuild the styles on every render of every row.
const getStyles = () => ({
  // TagList centers its tags by default; in a table column they need to line up with the header.
  tagList: css({ justifyContent: 'flex-start' }),
  nowrap: css({ whiteSpace: 'nowrap' }),
});
