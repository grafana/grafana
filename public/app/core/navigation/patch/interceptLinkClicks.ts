import { navigationLogger } from '../utils';
import { locationService } from '@grafana/runtime';

export function interceptLinkClicks(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (target && target.tagName === 'A') {
    const href = target.getAttribute('href');

    if (href) {
      navigationLogger('utils', false, 'intercepting link click', e);
      e.preventDefault();
      locationService.push(href);
    }
  }
}
