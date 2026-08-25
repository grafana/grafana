import { css, cx } from '@emotion/css';
import { memo, type ReactNode, useMemo } from 'react';
import Skeleton from 'react-loading-skeleton';

import { dateTimeFormat, dateTimeFormatTimeAgo, type GrafanaTheme2 } from '@grafana/data';
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
import { getNeutralTagListStyle } from '../tagColors';
import { notebookEditHref, notebookShareUrl, notebookViewUrl } from '../urls';

import { NotebookRowMenu } from './NotebookRowMenu';
import { type NotebookRow } from './useNotebooksList';

interface Props {
  notebooks: NotebookRow[];
}

/**
 * Id, header, geometry and loading placeholder per column, shared by the table and its skeleton.
 * Held in one place so the placeholder keeps the real shape and the two cannot drift apart.
 *
 * A plain function rather than a hook: both callers build their columns inside the useMemo
 * InteractiveTable asks for, so this runs there and needs no memo of its own.
 */
function getColumnLayout() {
  return {
    // Title is capped so it stops absorbing all the table's slack; tags take the remainder.
    title: {
      id: 'title',
      header: t('notebooks.list.table.title', 'Title'),
      width: 320,
      maxWidth: 320,
      skeleton: () => <Skeleton width={220} />,
    },
    authorName: {
      id: 'authorName',
      header: t('notebooks.list.table.author', 'Author'),
      width: 180,
      skeleton: () => <Skeleton width={120} />,
    },
    tags: {
      id: 'tags',
      header: t('notebooks.list.table.tags', 'Tags'),
      minWidth: 160,
      skeleton: () => <TagList.Skeleton />,
    },
    created: {
      id: 'created',
      header: t('notebooks.list.table.created', 'Created'),
      width: 120,
      disableGrow: true,
      skeleton: () => <Skeleton width={70} />,
    },
    updated: {
      id: 'updated',
      header: t('notebooks.list.table.updated', 'Updated'),
      width: 120,
      disableGrow: true,
      skeleton: () => <Skeleton width={70} />,
    },
    actions: {
      id: 'actions',
      header: '',
      disableGrow: true,
      skeleton: () => <Skeleton width={60} />,
    },
  } satisfies Record<string, ColumnLayout>;
}

/** One column's shared definition: everything but the cell, plus what stands in for it while loading. */
type ColumnLayout = Omit<Column<NotebookRow>, 'cell' | 'sortType'> & { skeleton: () => ReactNode };

/** Drops the placeholder, so what is left is a column the real table can spread. */
function withoutSkeleton({ skeleton, ...column }: ColumnLayout) {
  return column;
}

export function NotebooksTable({ notebooks }: Props) {
  const styles = useStyles2(getStyles);

  // InteractiveTable requires memoized columns, and styles is memoized by useStyles2, so this stays
  // referentially stable and the table doesn't remount.
  const columns: Array<Column<NotebookRow>> = useMemo(() => {
    const layout = getColumnLayout();

    return [
      {
        ...withoutSkeleton(layout.title),
        sortType: 'string',
        cell: ({ row: { original } }) => (
          <TextLink color="primary" inline={false} href={notebookViewUrl(original.uid)} title={original.title}>
            {original.title}
          </TextLink>
        ),
      },
      {
        ...withoutSkeleton(layout.authorName),
        sortType: 'string',
      },
      {
        ...withoutSkeleton(layout.tags),
        cell: ({ row: { original } }) => <TagList tags={original.tags} displayMax={3} className={styles.tagList} />,
      },
      {
        ...withoutSkeleton(layout.created),
        sortType: 'number',
        cell: ({ row: { original } }) => <RelativeTime timestamp={original.created} />,
      },
      {
        ...withoutSkeleton(layout.updated),
        sortType: 'number',
        cell: ({ row: { original } }) => <RelativeTime timestamp={original.updated} />,
      },
      {
        ...withoutSkeleton(layout.actions),
        cell: ({ row: { original } }) => <NotebookRowActions uid={original.uid} />,
      },
    ];
  }, [styles]);

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
  // Memoized because InteractiveTable requires it, and derived from the shared layout so the
  // columns are the real ones by construction rather than by being kept in step by hand.
  const columns: Array<Column<SkeletonRow>> = useMemo(
    () =>
      Object.values(getColumnLayout()).map(({ skeleton, ...column }) => ({
        ...column,
        cell: skeleton,
      })),
    []
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
const getStyles = (theme: GrafanaTheme2) => ({
  // TagList centers its tags by default; in a table column they need to line up with the header.
  tagList: cx(getNeutralTagListStyle(theme), css({ justifyContent: 'flex-start' })),
  nowrap: css({ whiteSpace: 'nowrap' }),
});
