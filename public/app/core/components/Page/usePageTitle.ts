import { useEffect } from 'react';

import { type NavModel, type NavModelItem } from '@grafana/data';
import { HOME_NAV_ID } from 'app/core/reducers/navModel';
import { useSelector } from 'app/types/store';

import { Branding } from '../Branding/Branding';
import { buildBreadcrumbs } from '../Breadcrumbs/utils';

/** The parts of a page's browser tab title, most specific first and ending with the app title. */
export function getPageTitleParts(navModel?: NavModel, pageNav?: NavModelItem, homeNav?: NavModelItem): string[] {
  const sectionNav = (navModel?.node !== navModel?.main ? navModel?.node : navModel?.main) ?? {
    text: Branding.AppTitle,
  };

  const parts: string[] = buildBreadcrumbs(sectionNav, pageNav, homeNav)
    .map((crumb) => crumb.text)
    .reverse();

  if (parts[parts.length - 1] !== Branding.AppTitle) {
    parts.push(Branding.AppTitle);
  }

  return parts;
}

export function usePageTitle(navModel?: NavModel, pageNav?: NavModelItem) {
  const homeNav = useSelector((state) => state.navIndex)?.[HOME_NAV_ID];
  useEffect(() => {
    document.title = getPageTitleParts(navModel, pageNav, homeNav).join(' - ');
  }, [homeNav, navModel, pageNav]);
}
