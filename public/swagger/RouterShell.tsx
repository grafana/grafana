import { css, cx } from '@emotion/css';
import { Global } from '@emotion/react';
import { type ReactNode } from 'react';

import { createTheme, type GrafanaTheme2, ThemeContext } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Icon, Stack, Text, Tooltip, useStyles2 } from '@grafana/ui';

type RouterPage = 'status' | 'manifests';

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
      <div style={{ padding: theme.spacing(2) }}>{children}</div>
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

export const Table = ({ headers, rows }: { headers: TableHeader[]; rows: ReactNode[][] }) => {
  const styles = useStyles2(getTableStyles);
  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            {headers.map((h) =>
              typeof h === 'string' ? (
                <th key={h}>{h}</th>
              ) : (
                <th key={h.label}>
                  <Tooltip content={h.tooltip}>
                    <span>
                      {h.label} <Icon name="info-circle" size="sm" />
                    </span>
                  </Tooltip>
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
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
