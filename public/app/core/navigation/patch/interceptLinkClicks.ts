import { locationService, navigationLogger } from '@grafana/runtime';

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
  while (element !== null && element.tagName) {
    if (element.tagName.toUpperCase() === 'A') {
      return element;
    }
    element = element.parentNode as HTMLElement;
  }

  return null;
}
