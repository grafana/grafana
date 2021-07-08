import { NavModel, NavModelItem } from '@grafana/data';

export enum CatalogTab {
  Browse = 'browse',
  Discover = 'discover',
  Library = 'library',
}

export function getCatalogNavModel(tab: CatalogTab, baseURL: string): NavModel {
  const pages: NavModelItem[] = [];

  if (!baseURL.endsWith('/')) {
    baseURL += '/';
  }

  pages.push({
    text: 'Browse',
    icon: 'icon-gf icon-gf-apps',
    url: `${baseURL}${CatalogTab.Browse}`,
    id: CatalogTab.Browse,
  });

  pages.push({
    text: 'Library',
    icon: 'icon-gf icon-gf-apps',
    url: `${baseURL}${CatalogTab.Library}`,
    id: CatalogTab.Library,
  });

  const node: NavModelItem = {
    text: 'Catalog',
    icon: 'cog',
    subTitle: 'Manage plugin installations',
    breadcrumbs: [{ title: 'Plugins', url: 'plugins' }],
    children: setActivePage(tab, pages, CatalogTab.Browse),
  };

  return {
    node: node,
    main: node,
  };
}

function setActivePage(pageId: CatalogTab, pages: NavModelItem[], defaultPageId: CatalogTab): NavModelItem[] {
  let found = false;
  const selected = pageId || defaultPageId;
  const changed = pages.map((p) => {
    const active = !found && selected === p.id;
    if (active) {
      found = true;
    }
    return { ...p, active };
  });

  if (!found) {
    changed[0].active = true;
  }

  return changed;
}
