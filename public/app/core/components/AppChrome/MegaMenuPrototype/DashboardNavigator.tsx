// PROTOTYPE — throwaway. The dashboard navigator: a panel beside the mega menu with a search, recent
// and starred dashboards and the folder tree. Same in every variant.
/* eslint-disable @grafana/i18n/no-untranslated-strings */
import { css, cx } from '@emotion/css';
import { type ReactNode, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom-v5-compat';

import { type GrafanaTheme2 } from '@grafana/data';
import { getBackendSrv, locationService } from '@grafana/runtime';
import { Icon, IconButton, Input, Link, useStyles2 } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';
import impressionSrv from 'app/core/services/impression_srv';

import { MENU_WIDTH } from '../MegaMenu/MegaMenu';
import { getChromeHeaderLevelHeight } from '../TopBar/useChromeHeaderHeight';

import {
  dashboardNavigatorStore,
  isDashboardsPath,
  setDashboardNavigatorOpen,
  usePrototypeVariant,
  useStoreValue,
} from './state';

interface Hit {
  uid: string;
  title: string;
  type: 'dash-db' | 'dash-folder';
  url: string;
  folderTitle?: string;
}

const search = (params: Record<string, unknown>) => getBackendSrv().get<Hit[]>('/api/search', params);

/** Choosing Dashboards in the mega menu: open the navigator and the most recent dashboard. */
export async function openDashboardsFromMenu() {
  const [recent] = await impressionSrv.getDashboardOpened();
  setDashboardNavigatorOpen(true);
  locationService.push(recent ? `/d/${recent}` : '/dashboards');
}

/** Whether the navigator is showing, so the page can make room for it. */
export function useDashboardNavigatorVisible() {
  const variant = usePrototypeVariant();
  const open = useStoreValue(dashboardNavigatorStore);
  const { pathname } = useLocation();
  return Boolean(variant && open && isDashboardsPath(pathname));
}

export function DashboardNavigatorHost() {
  const visible = useDashboardNavigatorVisible();
  const open = useStoreValue(dashboardNavigatorStore);
  const { pathname } = useLocation();

  // Leaving the Dashboards section closes it.
  useEffect(() => {
    if (open && !isDashboardsPath(pathname)) {
      setDashboardNavigatorOpen(false);
    }
  }, [open, pathname]);

  return visible ? <DashboardNavigator /> : null;
}

function DashboardNavigator() {
  const styles = useStyles2(getStyles);
  const { chrome } = useGrafana();
  const state = chrome.useState();
  const { pathname } = useLocation();
  const currentUid = pathname.match(/^\/d\/([^/]+)/)?.[1];
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Hit[] | undefined>();
  const [recent, setRecent] = useState<Hit[]>([]);
  const [starred, setStarred] = useState<Hit[]>([]);

  useEffect(() => {
    impressionSrv.getDashboardOpened().then(async (uids) => {
      const top = uids.slice(0, 5);
      if (!top.length) {
        return;
      }
      const hits = await search({ dashboardUIDs: top });
      setRecent(top.map((uid) => hits.find((h) => h.uid === uid)).filter((h): h is Hit => Boolean(h)));
    });
    // Recent order changes as you open dashboards; refresh on each navigation.
  }, [currentUid]);

  useEffect(() => {
    search({ starred: true }).then(setStarred);
  }, []);

  useEffect(() => {
    if (!query) {
      setResults(undefined);
      return;
    }
    const t = setTimeout(() => search({ query, limit: 30 }).then(setResults), 200);
    return () => clearTimeout(t);
  }, [query]);

  const left = state.megaMenuDocked && state.megaMenuOpen ? MENU_WIDTH : 0;

  return (
    <aside
      className={styles.panel}
      style={{ left, top: getChromeHeaderLevelHeight() }}
      aria-label="Dashboard navigator"
    >
      <div className={styles.header}>
        <Icon name="apps" />
        <span className={styles.title}>Dashboards</span>
        <Link href="/dashboards" className={styles.browse}>
          Browse
        </Link>
        <IconButton
          name="times"
          aria-label="Close dashboard navigator"
          onClick={() => setDashboardNavigatorOpen(false)}
        />
      </div>
      <Input
        prefix={<Icon name="search" />}
        placeholder="Search dashboards and folders"
        value={query}
        onChange={(e) => setQuery(e.currentTarget.value)}
      />
      <div className={styles.scroll}>
        {results ? (
          <Group label={`Results (${results.length})`}>
            {results.map((h) => (
              <HitRow key={h.uid} hit={h} currentUid={currentUid} showFolder />
            ))}
          </Group>
        ) : (
          <>
            {recent.length > 0 && (
              <Group label="Recent">
                {recent.map((h) => (
                  <HitRow key={h.uid} hit={h} currentUid={currentUid} showFolder />
                ))}
              </Group>
            )}
            {starred.length > 0 && (
              <Group label="Starred">
                {starred.map((h) => (
                  <HitRow key={h.uid} hit={h} currentUid={currentUid} showFolder />
                ))}
              </Group>
            )}
            <Group label="Folders">
              <FolderChildren folderUid="general" depth={0} currentUid={currentUid} />
            </Group>
          </>
        )}
      </div>
    </aside>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.group}>
      <div className={styles.groupLabel}>{label}</div>
      <ul className={styles.list}>{children}</ul>
    </div>
  );
}

function FolderChildren({ folderUid, depth, currentUid }: { folderUid: string; depth: number; currentUid?: string }) {
  const [hits, setHits] = useState<Hit[] | undefined>();
  useEffect(() => {
    search({ folderUIDs: folderUid }).then(setHits);
  }, [folderUid]);
  if (!hits) {
    return null;
  }
  return (
    <>
      {hits.map((h) =>
        h.type === 'dash-folder' ? (
          <FolderRow key={h.uid} hit={h} depth={depth} currentUid={currentUid} />
        ) : (
          <HitRow key={h.uid} hit={h} depth={depth} currentUid={currentUid} />
        )
      )}
    </>
  );
}

function FolderRow({ hit, depth, currentUid }: { hit: Hit; depth: number; currentUid?: string }) {
  const styles = useStyles2(getStyles);
  const [open, setOpen] = useState(false);
  return (
    <>
      <li>
        <button
          type="button"
          className={styles.row}
          style={{ paddingLeft: 8 + depth * 16 }}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <Icon name={open ? 'angle-down' : 'angle-right'} />
          <Icon name={open ? 'folder-open' : 'folder'} />
          <span className={styles.text}>{hit.title}</span>
        </button>
      </li>
      {open && <FolderChildren folderUid={hit.uid} depth={depth + 1} currentUid={currentUid} />}
    </>
  );
}

function HitRow({
  hit,
  depth = 0,
  currentUid,
  showFolder,
}: {
  hit: Hit;
  depth?: number;
  currentUid?: string;
  showFolder?: boolean;
}) {
  const styles = useStyles2(getStyles);
  const isFolder = hit.type === 'dash-folder';
  return (
    <li>
      <Link
        href={hit.url}
        className={cx(styles.row, hit.uid === currentUid && styles.rowActive)}
        style={{ paddingLeft: 8 + depth * 16 + (showFolder ? 0 : 16) }}
      >
        <Icon name={isFolder ? 'folder' : 'apps'} />
        <span className={styles.text}>{hit.title}</span>
        {showFolder && hit.folderTitle && <span className={styles.folder}>{hit.folderTitle}</span>}
      </Link>
    </li>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  panel: css({
    position: 'fixed',
    bottom: 0,
    width: MENU_WIDTH,
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    padding: theme.spacing(1),
    background: theme.colors.background.primary,
    borderRight: `1px solid ${theme.colors.border.weak}`,
    borderLeft: `1px solid ${theme.colors.border.weak}`,
  }),
  header: css({ display: 'flex', alignItems: 'center', gap: theme.spacing(1), padding: theme.spacing(0.5, 0.5, 0) }),
  title: css({ flex: 1, fontWeight: theme.typography.fontWeightMedium }),
  browse: css({ fontSize: theme.typography.bodySmall.fontSize, color: theme.colors.text.link }),
  scroll: css({ flex: 1, minHeight: 0, overflowY: 'auto' }),
  group: css({ marginBottom: theme.spacing(1.5) }),
  groupLabel: css({
    padding: theme.spacing(0.5, 1),
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
  }),
  list: css({ listStyle: 'none', margin: 0, padding: 0 }),
  row: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    width: '100%',
    minHeight: theme.spacing(4),
    paddingRight: theme.spacing(1),
    border: 'none',
    background: 'transparent',
    borderRadius: theme.shape.radius.default,
    color: theme.colors.text.secondary,
    textAlign: 'left',
    '&:hover': { background: theme.colors.action.hover, color: theme.colors.text.primary },
  }),
  rowActive: css({ background: theme.colors.action.selected, color: theme.colors.text.primary }),
  text: css({ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }),
  folder: css({ fontSize: theme.typography.bodySmall.fontSize, color: theme.colors.text.disabled }),
});
