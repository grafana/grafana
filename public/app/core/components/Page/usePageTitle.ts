import { useEffect } from 'react';

import { type NavModel, type NavModelItem } from '@grafana/data';
import { HOME_NAV_ID } from 'app/core/reducers/navModel';
import { useSelector } from 'app/types/store';

import { Branding } from '../Branding/Branding';
import { type Breadcrumb } from '../Breadcrumbs/types';
import { buildBreadcrumbs } from '../Breadcrumbs/utils';

function getPageCrumbs(navModel?: NavModel, pageNav?: NavModelItem, homeNav?: NavModelItem): Breadcrumb[] {
  const sectionNav = (navModel?.node !== navModel?.main ? navModel?.node : navModel?.main) ?? {
    text: Branding.AppTitle,
  };
  return buildBreadcrumbs(sectionNav, pageNav, homeNav);
}

/** The parts of a page's browser tab title, most specific first and ending with the app title. */
export function getPageTitleParts(navModel?: NavModel, pageNav?: NavModelItem, homeNav?: NavModelItem): string[] {
  const parts: string[] = getPageCrumbs(navModel, pageNav, homeNav)
    .map((crumb) => crumb.text)
    .reverse();

  if (parts[parts.length - 1] !== Branding.AppTitle) {
    parts.push(Branding.AppTitle);
  }

  return parts;
}

/**
 * The page's name: its last breadcrumb, or the one before it when the last has no link. A crumb without a link
 * names the page's state rather than the page, as Explore's data source does; a dashboard's crumb links to it.
 * Undefined when that leaves no crumb, or only the app title.
 */
export function getPageName(navModel?: NavModel, pageNav?: NavModelItem, homeNav?: NavModelItem): string | undefined {
  const crumbs = getPageCrumbs(navModel, pageNav, homeNav);
  const last = crumbs.at(-1);
  const named = last?.href ? last : crumbs.at(-2);
  return named && named.text !== Branding.AppTitle ? named.text : undefined;
}

export function usePageTitle(navModel?: NavModel, pageNav?: NavModelItem) {
  const homeNav = useSelector((state) => state.navIndex)?.[HOME_NAV_ID];
  useEffect(() => {
    document.title = getPageTitleParts(navModel, pageNav, homeNav).join(' - ');
  }, [homeNav, navModel, pageNav]);
}
