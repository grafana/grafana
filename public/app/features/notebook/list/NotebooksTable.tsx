import { css } from '@emotion/css';
import { memo, useMemo } from 'react';
import Skeleton from 'react-loading-skeleton';

import { dateTimeFormat, dateTimeFormatTimeAgo } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  ClipboardButton,
  type Column,
  Dropdown,
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

import { NotebookRowMenu } from './NotebookRowMenu';
import { type NotebookRow } from './useNotebooksList';

interface Props {
  notebooks: NotebookRow[];
}

/**
 * Header and geometry per column, shared by the table and its loading skeleton. Held in one place
 * so the placeholder keeps the real shape and the two cannot drift apart.
 */
function useColumnLayout() {
  return useMemo(
    () => ({
      // Title is capped so it stops absorbing all the table's slack; tags take the remainder.
      title: { header: t('notebooks.list.table.title', 'Title'), width: 320, maxWidth: 320 },
      authorName: { header: t('notebooks.list.table.author', 'Author'), width: 180 },
      tags: { header: t('notebooks.list.table.tags', 'Tags'), minWidth: 160 },
      created: { header: t('notebooks.list.table.created', 'Created'), width: 120, disableGrow: true },
      updated: { header: t('notebooks.list.table.updated', 'Updated'), width: 120, disableGrow: true },
      actions: { header: '', disableGrow: true },
    }),
    []
  );
}

export function NotebooksTable({ notebooks }: Props) {
  const styles = useStyles2(getStyles);
  const layout = useColumnLayout();

  const columns: Array<Column<NotebookRow>> = useMemo(
    () => [
      {
        id: 'title',
        ...layout.title,
        sortType: 'string',
        cell: ({ row: { original } }) => (
          <TextLink color="primary" inline={false} href={notebookViewUrl(original.uid)} title={original.title}>
            {original.title}
          </TextLink>
        ),
      },
      {
        id: 'authorName',
        ...layout.authorName,
        sortType: 'string',
      },
      {
        id: 'tags',
        ...layout.tags,
        cell: ({ row: { original } }) => <TagList tags={original.tags} displayMax={3} className={styles.tagList} />,
      },
      {
        id: 'created',
        ...layout.created,
        sortType: 'number',
        cell: ({ row: { original } }) => <RelativeTime timestamp={original.created} />,
      },
      {
        id: 'updated',
        ...layout.updated,
        sortType: 'number',
        cell: ({ row: { original } }) => <RelativeTime timestamp={original.updated} />,
      },
      {
        id: 'actions',
        ...layout.actions,
        cell: ({ row: { original } }) => <NotebookRowActions uid={original.uid} />,
      },
    ],
    // styles and layout are memoized, so this stays referentially stable and the table doesn't remount.
    [styles, layout]
  );

  return (
    <InteractiveTable
      columns={columns}
      data={notebooks}
      getRowId={(notebook) => notebook.uid}
      initialSortBy={[{ id: 'updated', desc: true }]}
      pageSize={ROWS_PER_PAGE}
      // Deliberately not autoResetPage: it keys on the data reference, and these rows get a new one
      // every time another cursor page lands or an author name resolves, which would drag a reader
      // back to page 1 while the list is still filling in. Narrowing the set has to reset the page
      // too, but that is a change of filters, so the caller remounts this table for it.
    />
  );
}

interface SkeletonRow {
  uid: string;
}

/**
 * The table's shape while a new set of filters loads: same headers and column widths, placeholders
 * where the cells go. Built on the same InteractiveTable and the shared layout so the header and
 * the column geometry cannot drift from the real thing, and the page does not jump when the rows
 * arrive.
 */
export function NotebooksTableSkeleton() {
  const layout = useColumnLayout();

  const columns: Array<Column<SkeletonRow>> = useMemo(
    () => [
      { id: 'title', ...layout.title, cell: () => <Skeleton width={220} /> },
      { id: 'authorName', ...layout.authorName, cell: () => <Skeleton width={120} /> },
      { id: 'tags', ...layout.tags, cell: () => <TagList.Skeleton /> },
      { id: 'created', ...layout.created, cell: () => <Skeleton width={70} /> },
      { id: 'updated', ...layout.updated, cell: () => <Skeleton width={70} /> },
      { id: 'actions', ...layout.actions, cell: () => <Skeleton width={60} /> },
    ],
    [layout]
  );

  const rows = useMemo(() => Array.from({ length: SKELETON_ROWS }, (_, i) => ({ uid: `skeleton-${i}` })), []);

  return (
    // Announced as one busy region rather than letting each placeholder speak for itself.
    <div role="status" aria-label={t('notebooks.list.loading', 'Loading notebooks')}>
      <InteractiveTable columns={columns} data={rows} getRowId={(row) => row.uid} />
    </div>
  );
}

/**
 * Enough to read as a list without filling the viewport with grey. The wait is one request, and the
 * real page that replaces this is ROWS_PER_PAGE long.
 */
const SKELETON_ROWS = 5;

/**
 * The table renders every row it is given — no virtualization — and each row carries a link, a tag
 * list, two tooltipped timestamps and three buttons. At a full page from the server that is thousands
 * of elements rebuilt whenever a filter changes, which is felt as a delay on the click. Sorting and
 * the row counts still run over the whole set: react-table paginates after sorting.
 *
 * The other page-level tables in Grafana sit between 10 and 30, so this is in step with them.
 */
export const ROWS_PER_PAGE = 20;

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
      <Dropdown overlay={<NotebookRowMenu uid={uid} />} placement="bottom-end">
        <IconButton
          name="ellipsis-v"
          variant="secondary"
          // Dropdown injects aria-expanded but not aria-haspopup, so without this the trigger
          // announces as a plain button and gives no hint that it opens a menu.
          aria-haspopup="menu"
          // No aria-label alongside: IconButton uses a string tooltip as the accessible name.
          tooltip={t('notebooks.list.table.more-actions', 'More actions')}
        />
      </Dropdown>
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
