import { css } from '@emotion/css';
import { memo, useMemo } from 'react';

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
  useStyles2,
} from '@grafana/ui';

import { canEditNotebooks } from '../permissions';
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
        sortType: 'number',
        disableGrow: true,
        width: 120,
        cell: ({ row: { original } }) => <RelativeTime timestamp={original.created} />,
      },
      {
        id: 'updated',
        header: t('notebooks.list.table.updated', 'Updated'),
        sortType: 'number',
        disableGrow: true,
        width: 120,
        cell: ({ row: { original } }) => <RelativeTime timestamp={original.updated} />,
      },
      {
        id: 'actions',
        header: '',
        disableGrow: true,
        cell: ({ row: { original } }) => <NotebookRowActions uid={original.uid} />,
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
      pageSize={ROWS_PER_PAGE}
      // Filtering replaces the data. Without this the table keeps the page index it was on, so
      // narrowing the set from page 3 renders an empty page that no empty state covers.
      autoResetPage
    />
  );
}

/**
 * The table renders every row it is given — no virtualization — and each row carries a link, a tag
 * list, two tooltipped timestamps and three buttons. At a full page from the server that is thousands
 * of elements rebuilt whenever a filter changes, which is felt as a delay on the click. Sorting and
 * the row counts still run over the whole set: react-table paginates after sorting.
 *
 * 25 to match the other page-level resource tables (team folders, the provisioning resource tree).
 */
export const ROWS_PER_PAGE = 25;

/**
 * timestamp is unix millis; zero means the index has no value for it.
 *
 * Memoized on the timestamp alone, not on the row: filtering hands the table a fresh array of fresh
 * row objects, so a cell that took the row would rebuild its tooltip for every notebook still on
 * screen. There are two of these per row, and they are the reason this matters.
 */
const RelativeTime = memo(function RelativeTime({ timestamp }: { timestamp: number }) {
  const styles = useStyles2(getStyles);

  if (!timestamp) {
    return null;
  }

  return (
    <Tooltip content={dateTimeFormat(timestamp)}>
      <span className={styles.nowrap}>{dateTimeFormatTimeAgo(timestamp)}</span>
    </Tooltip>
  );
});

/** Takes the uid rather than the row for the same reason as RelativeTime: three buttons per row. */
const NotebookRowActions = memo(function NotebookRowActions({ uid }: { uid: string }) {
  // Omitted rather than disabled for a user who cannot edit, matching the create button on the page
  // around this table.
  const canEdit = canEditNotebooks();

  return (
    <Stack alignItems="center" justifyContent="flex-end" gap={1}>
      {canEdit && (
        <LinkButton variant="secondary" size="sm" icon="pen" href={notebookEditHref(uid)}>
          {t('notebooks.list.table.edit', 'Edit')}
        </LinkButton>
      )}
      <ClipboardButton variant="secondary" size="sm" icon="link" getText={() => notebookShareUrl(uid)}>
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
});

// Module scope so useStyles2 can memoize — it keys its cache on the function's identity, so an
// inline arrow would rebuild the styles on every render of every row.
const getStyles = () => ({
  // TagList centers its tags by default; in a table column they need to line up with the header.
  tagList: css({ justifyContent: 'flex-start' }),
  nowrap: css({ whiteSpace: 'nowrap' }),
});
