import { locationUtil, urlUtil } from '@grafana/data';
import { locationService, navigationLogger } from '@grafana/runtime';
import { config } from 'app/core/config';

export function interceptLinkClicks(e: MouseEvent) {
  const anchor = e.target instanceof HTMLElement ? getParentAnchor(e.target) : null;

  // Ignore if opening new tab or already default prevented
  if (e.ctrlKey || e.metaKey || e.defaultPrevented) {
    return;
  }

  if (anchor) {
    let href = anchor.getAttribute('href');
    const target = anchor.getAttribute('target');

    if (href && !target) {
      const params = urlUtil.parseKeyValue(href.split('?')[1]);
      const orgIdChange = params.orgId && Number(params.orgId) !== config.bootData.user.orgId;
      navigationLogger('utils', false, 'intercepting link click', e);
      e.preventDefault();

      href = locationUtil.stripBaseFromUrl(href);

      // Ensure old angular urls with no starting '/' are handled the same as before
      // Make sure external links are handled correctly
      // That is they where seen as being absolute from app root
      if (href[0] !== '/' || orgIdChange) {
        // if still contains protocol or is a mailto link, it's an absolute link to another domain or web application
        if (href.indexOf('://') > 0 || href.indexOf('mailto:') === 0 || orgIdChange) {
          window.location.href = href;
          return;
        } else if (href.indexOf('#') === 0) {
          // If it is a hash click, update the hash instead of trying to update the history
          window.location.hash = href;
          return;
        } else {
          href = `/${href}`;
        }
      }
      locationService.push(href);
    }
  }
}

function getParentAnchor(element: HTMLElement | null): HTMLElement | null {
  while (element !== null && element.tagName) {
    if (element.tagName.toUpperCase() === 'A') {
      return element;
    }
    element = element.parentElement;
  }

  return null;
}
