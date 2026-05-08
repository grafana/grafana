import { locationUtil, urlUtil, type LinkModel, type LinkTarget } from '@grafana/data';
import { locationService } from '@grafana/runtime';

import { contextSrv } from '../services/context_srv';

// Programmatically follow an href, preferring SPA routing for same-origin
// targets so the dashboard scene stays mounted (variable changes, scroll
// position, etc.). Used by chart oneClick handlers and by interceptLinkClicks
// for anchor clicks — keep both paths converging here so they cannot drift.
export function navigateToHref(rawHref: string, target?: LinkTarget) {
  if (target === '_blank') {
    window.open(rawHref, '_blank', 'noopener,noreferrer');
    return;
  }

  let href = locationUtil.stripBaseFromUrl(rawHref);

  const params = urlUtil.parseKeyValue(href.split('?')[1] ?? '');
  const orgIdChange = params.orgId != null && Number(params.orgId) !== contextSrv.user.orgId;

  if (href[0] !== '/' || orgIdChange) {
    if (href.indexOf('://') > 0 || href.indexOf('mailto:') === 0 || orgIdChange) {
      window.location.href = href;
      return;
    }

    if (href.indexOf('#') === 0) {
      window.location.hash = href;
      return;
    }

    href = `/${href}`;
  }

  locationService.push(href);
}

export const navigateToOneClickLink = (link: LinkModel) => navigateToHref(link.href, link.target);
