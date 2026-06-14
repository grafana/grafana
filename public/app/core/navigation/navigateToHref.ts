import { locationUtil, urlUtil, type LinkModel, type LinkTarget } from '@grafana/data';
import { locationService } from '@grafana/runtime';

import { contextSrv } from '../services/context_srv';

// Navigate to an href using SPA routing when possible, mirroring the rules in
// interceptLinkClicks. Use this for programmatic navigation (e.g. chart clicks)
// where there is no real anchor element to dispatch through.
export function navigateToHref(rawHref: string, target?: LinkTarget) {
  if (target === '_blank') {
    window.open(rawHref, '_blank', 'noopener,noreferrer');
    return;
  }

  const params = urlUtil.parseKeyValue(rawHref.split('?')[1] ?? '');
  const orgIdChange = Boolean(params.orgId) && Number(params.orgId) !== contextSrv.user.orgId;

  let href = locationUtil.stripBaseFromUrl(rawHref);

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

// Shared TooltipPlugin2#onOneClickLink handler for panels that surface oneClick
// data links from a chart click. Lives here (not in @grafana/ui) so it can use
// locationService for SPA navigation.
export const navigateToOneClickLink = (link: LinkModel) => navigateToHref(link.href, link.target);
