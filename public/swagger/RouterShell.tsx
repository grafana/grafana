import { css, cx } from '@emotion/css';
import { Global } from '@emotion/react';
import { type ReactNode, useMemo, useState } from 'react';

import { createTheme, type GrafanaTheme2, store, ThemeContext } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Alert, Icon, Stack, Text, Tooltip, useStyles2 } from '@grafana/ui';

type RouterPage = 'status' | 'manifests';

const fixtureKeys = ['routerStatusFixture', 'routerManifestsFixture'];

// Dev builds can render a response copied from another stack:
// localStorage.setItem(key, JSON.stringify(doc))
export function devFixture<T>(key: string): T | undefined {
  const raw = process.env.NODE_ENV === 'development' ? store.get(key) : null;
  return raw ? JSON.parse(raw) : undefined;
}

const FixtureBanner = () => {
  const active = fixtureKeys.filter((k) => devFixture(k) !== undefined);
  if (!active.length) {
    return null;
  }
  return (
    <Alert
      severity="warning"
      title={t('swagger.router-fixtures.title', 'Showing saved fixture data, not this server')}
      buttonContent={t('swagger.router-fixtures.clear', 'Clear fixtures')}
      onRemove={() => {
        fixtureKeys.forEach((k) => store.delete(k));
        window.location.reload();
      }}
    >
      {active.join(', ')}
    </Alert>
  );
};

/** The frame shared by the router debugging pages, with links between them and the API docs. */
export const RouterShell = ({
  page,
  actions,
  children,
}: {
  page: RouterPage;
  actions?: ReactNode;
  children: ReactNode;
}) => {
  const theme = createTheme({ colors: { mode: 'light' } });
  return (
    <ThemeContext.Provider value={theme}>
      <Global
        styles={{
          // Sizes include padding and borders, as in Grafana: otherwise an input
          // with a width overflows into what follows it.
          html: {
            fontSize: `${theme.typography.htmlFontSize}px`,
            boxSizing: 'border-box',
          },
          '*, *::before, *::after': {
            boxSizing: 'inherit',
          },
          body: {
            margin: 0,
            ...theme.typography.body,
          },
        }}
      />
      <div style={{ backgroundColor: '#000', padding: '10px' }}>
        <Stack alignItems="center" justifyContent="space-between">
          <Stack alignItems="center" gap={3}>
            <Icon name="grafana" size="xxl" />
            <Nav page={page} />
          </Stack>
          {actions}
        </Stack>
      </div>
      <div style={{ padding: theme.spacing(2) }}>
        <FixtureBanner />
        {children}
      </div>
    </ThemeContext.Provider>
  );
};

const Nav = ({ page }: { page: RouterPage }) => {
  const styles = useStyles2(getStyles);
  const links: Array<{ page?: RouterPage; href: string; label: string }> = [
    { href: 'swagger', label: t('swagger.router-nav.api-docs', 'API docs') },
    { page: 'status', href: 'swagger?router=status', label: t('swagger.router-nav.status', 'Status') },
    { page: 'manifests', href: 'swagger?router=manifests', label: t('swagger.router-nav.manifests', 'Manifests') },
  ];
  return (
    <Stack gap={2}>
      {links.map((l) => (
        <a key={l.href} href={l.href} className={cx(styles.link, l.page === page && styles.active)}>
          {l.label}
        </a>
      ))}
    </Stack>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  link: css({
    color: 'rgba(255, 255, 255, 0.65)',
    '&:hover': {
      color: '#fff',
    },
  }),
  active: css({
    color: '#fff',
    fontWeight: theme.typography.fontWeightMedium,
  }),
});

export const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <Stack direction="column" gap={1}>
    <Text element="h3">{title}</Text>
    {children}
  </Stack>
);

/** A table column's header: its label, with a tooltip explaining it when one is given. */
export type TableHeader = string | { label: string; tooltip: string };

/** What a row sorts by in each column; a column without any sort values is not sortable. */
export type SortValue = string | number | undefined;

const collator = new Intl.Collator(undefined, { numeric: true });

const compareSortValues = (a: SortValue, b: SortValue) => {
  if (a === b) {
    return 0;
  }
  // Rows without a value sort last, whichever the direction
  if (a === undefined || b === undefined) {
    return a === undefined ? 1 : -1;
  }
  return typeof a === 'number' && typeof b === 'number' ? a - b : collator.compare(String(a), String(b));
};

export const Table = ({
  headers,
  rows,
  sortValues,
  defaultSort,
  onRowClick,
}: {
  headers: TableHeader[];
  rows: ReactNode[][];
  /** Aligned with rows: one sort value per cell. Makes the columns that have values sortable. */
  sortValues?: SortValue[][];
  defaultSort?: { column: number; descending?: boolean };
  /** Receives the index of the clicked row in rows, whatever the sort order. */
  onRowClick?: (row: number) => void;
}) => {
  const styles = useStyles2(getTableStyles);
  const [sort, setSort] = useState(defaultSort);

  const sortable = (column: number) => Boolean(sortValues?.some((row) => row[column] !== undefined));
  const order = useMemo(() => {
    const indexes = rows.map((_, i) => i);
    if (!sort || !sortValues) {
      return indexes;
    }
    const direction = sort.descending ? -1 : 1;
    return indexes.sort((x, y) => {
      const a = sortValues[x]?.[sort.column];
      const b = sortValues[y]?.[sort.column];
      if (a === undefined || b === undefined) {
        return compareSortValues(a, b);
      }
      return direction * compareSortValues(a, b) || x - y;
    });
  }, [rows, sortValues, sort]);

  const toggle = (column: number) =>
    setSort((prev) => ({ column, descending: prev?.column === column && !prev.descending }));

  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            {headers.map((h, column) => {
              const label = typeof h === 'string' ? h : h.label;
              const content =
                typeof h === 'string' ? (
                  label
                ) : (
                  <Tooltip content={h.tooltip}>
                    <span>
                      {label} <Icon name="info-circle" size="sm" />
                    </span>
                  </Tooltip>
                );
              if (!sortable(column)) {
                return <th key={label}>{content}</th>;
              }
              const active = sort?.column === column;
              return (
                <th key={label} aria-sort={active ? (sort.descending ? 'descending' : 'ascending') : 'none'}>
                  <button type="button" className={styles.sortButton} onClick={() => toggle(column)}>
                    {content}
                    {active && <Icon name={sort.descending ? 'arrow-down' : 'arrow-up'} size="sm" />}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {order.map((i) => (
            <tr key={i} className={onRowClick ? styles.clickable : undefined} onClick={() => onRowClick?.(i)}>
              {rows[i].map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const getTableStyles = (theme: GrafanaTheme2) => ({
  sortButton: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    padding: 0,
    border: 0,
    background: 'none',
    color: 'inherit',
    font: 'inherit',
    cursor: 'pointer',
  }),
  clickable: css({
    cursor: 'pointer',
    '&:hover': { background: theme.colors.action.hover },
  }),
  wrapper: css({
    overflowX: 'auto',
  }),
  table: css({
    borderCollapse: 'collapse',
    width: '100%',
    'th, td': {
      textAlign: 'left',
      padding: theme.spacing(0.5, 1),
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      verticalAlign: 'top',
      whiteSpace: 'nowrap',
    },
    th: {
      fontWeight: theme.typography.fontWeightMedium,
      color: theme.colors.text.secondary,
    },
  }),
});
