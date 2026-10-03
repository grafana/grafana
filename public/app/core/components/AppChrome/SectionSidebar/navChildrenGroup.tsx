import { useLocation } from 'react-router-dom-v5-compat';

import { type IconName, isIconName, locationUtil, type NavModelItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useSelector } from 'app/types/store';

import {
  SectionSidebarDivider,
  SectionSidebarGroup,
  SectionSidebarItem,
  SectionSidebarMenuRow,
  useSectionSidebarExpanded,
} from './primitives';
import { type SectionSidebarGroupProvider } from './types';

// Keeps rows aligned when a nav item has no icon of its own (e.g. Recently deleted)
const FALLBACK_ICON = 'file-alt';

/**
 * A group listing the children of a nav tree node, so a section's own pages
 * (e.g. Playlists or Snapshots under Dashboards) stay one click away. Nested
 * nav nodes (e.g. Administration's groups) expand inline.
 */
export function createNavChildrenGroup({
  id,
  title,
  navId,
  divider,
  pick,
  parentTitle,
}: {
  id: string;
  title: string;
  navId: string;
  /** Separates the pages from groups that follow them */
  divider?: boolean;
  /** Only these child ids, in this order; children the user can't see are skipped */
  pick?: string[];
  /** Lists the nav node itself first under this title, e.g. "Browse dashboards" */
  parentTitle?: string;
}) {
  function NavChildrenGroup() {
    const { children, activeUrl } = useNavChildren(navId, { pick, parentTitle });

    if (children.length === 0) {
      return null;
    }

    return (
      <>
        <SectionSidebarGroup id={id}>
          {children.map((child) => (
            <NavChildItem key={child.id ?? child.url} item={child} activeUrl={activeUrl} level={0} />
          ))}
        </SectionSidebarGroup>
        {divider && <SectionSidebarDivider />}
      </>
    );
  }

  const provider: SectionSidebarGroupProvider = {
    id,
    title,
    Component: NavChildrenGroup,
  };
  return provider;
}

/**
 * The section's own landing page as a row, with its other pages tucked into a "More" menu so they
 * stay reachable without crowding the sidebar.
 */
export function createNavMoreGroup({
  id,
  title,
  navId,
  primaryTitle,
  primaryIcon,
  dividerAfter,
}: {
  id: string;
  title: string;
  navId: string;
  primaryTitle: string;
  primaryIcon: IconName;
  dividerAfter?: boolean;
}) {
  function NavMoreGroup() {
    const { pathname } = useLocation();
    const node = useSelector((state) => state.navIndex[navId]);
    const others = getVisibleChildren(node);

    if (!node?.url) {
      return null;
    }

    return (
      <SectionSidebarGroup id={id}>
        <SectionSidebarItem
          title={primaryTitle}
          icon={primaryIcon}
          url={node.url}
          active={toPath(node.url) === pathname}
        />
        <SectionSidebarMenuRow
          title={t('section-sidebar.nav.more', 'More')}
          icon="ellipsis-h"
          items={others.map((child) => ({
            id: child.id ?? child.text,
            label: child.text,
            icon: getIcon(child),
            url: child.url,
          }))}
        />
      </SectionSidebarGroup>
    );
  }

  const provider: SectionSidebarGroupProvider = { id, title, Component: NavMoreGroup, dividerAfter };
  return provider;
}

function NavChildItem({ item, activeUrl, level }: { item: NavModelItem; activeUrl?: string; level: number }) {
  const children = getVisibleChildren(item);
  const hasActiveChild = children.some((child) => containsUrl(child, activeUrl));
  const [expanded, setExpanded] = useSectionSidebarExpanded(item.id && `nav.${item.id}`, hasActiveChild);

  return (
    <SectionSidebarItem
      title={item.text}
      icon={level === 0 ? getIcon(item) : undefined}
      url={item.url}
      level={level}
      active={Boolean(activeUrl) && toPath(item.url) === activeUrl}
      expandable={children.length > 0}
      expanded={expanded}
      onToggle={() => setExpanded(!expanded)}
    >
      {children.map((child) => (
        <NavChildItem key={child.id ?? child.url} item={child} activeUrl={activeUrl} level={level + 1} />
      ))}
    </SectionSidebarItem>
  );
}

function useNavChildren(navId: string, { pick, parentTitle }: { pick?: string[]; parentTitle?: string }) {
  const { pathname } = useLocation();
  const node = useSelector((state) => state.navIndex[navId]);
  let children = getVisibleChildren(node);
  if (pick) {
    children = pick.flatMap((childId) => children.find((child) => child.id === childId) ?? []);
  }
  if (node?.url && parentTitle) {
    // Only the node itself, so its children aren't repeated as a nested tree
    children = [{ ...node, text: parentTitle, children: undefined }, ...children];
  }
  return { children, activeUrl: findActiveUrl(children, pathname) };
}

function getVisibleChildren(item: NavModelItem | undefined): NavModelItem[] {
  return (item?.children ?? []).filter((child) => child.url && !child.isCreateAction && !child.hideFromTabs);
}

function getIcon(item: NavModelItem): IconName {
  return isIconName(item.icon) ? item.icon : FALLBACK_ICON;
}

function toPath(url: string | undefined) {
  return url ? locationUtil.stripBaseFromUrl(url).split('?')[0] : undefined;
}

/** The longest item url matching the page, so a parent like `/alerting` doesn't also light up */
function findActiveUrl(items: NavModelItem[], pathname: string): string | undefined {
  let best: string | undefined;
  const visit = (item: NavModelItem) => {
    const path = toPath(item.url);
    if (path && (pathname === path || pathname.startsWith(`${path}/`)) && path.length > (best?.length ?? 0)) {
      best = path;
    }
    getVisibleChildren(item).forEach(visit);
  };
  items.forEach(visit);
  return best;
}

function containsUrl(item: NavModelItem, url: string | undefined): boolean {
  return (
    Boolean(url) && (toPath(item.url) === url || getVisibleChildren(item).some((child) => containsUrl(child, url)))
  );
}
