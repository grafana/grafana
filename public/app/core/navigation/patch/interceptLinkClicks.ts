import { navigationLogger } from '../utils';
import { locationService } from '@grafana/runtime';

export function interceptLinkClicks(e: MouseEvent) {
  const target = getParentAnchor(e.target as HTMLElement);

  if (target) {
    const href = target.getAttribute('href');

    if (href) {
      navigationLogger('utils', false, 'intercepting link click', e);
      e.preventDefault();
      locationService.push(href);
    }
  }
}

function getParentAnchor(element: HTMLElement | null): HTMLElement | null {
  while (element !== null) {
    if (element.tagName.toUpperCase() === 'A') {
      return element;
    }
    element = element.parentNode as HTMLElement;
  }

  return null;
}
