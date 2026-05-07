import { navigationLogger } from '@grafana/runtime';

import { navigateToHref } from '../navigateToHref';

export function interceptLinkClicks(e: MouseEvent) {
  const anchor = e.target instanceof Element && getParentAnchor(e.target);

  // Ignore if opening new tab or already default prevented
  if (e.ctrlKey || e.metaKey || e.defaultPrevented) {
    return;
  }

  if (anchor) {
    const href = anchor.getAttribute('href');
    const target = anchor.getAttribute('target');

    if (href && !target) {
      navigationLogger('utils', false, 'intercepting link click', e);
      e.preventDefault();
      navigateToHref(href);
    }
  }
}

function getParentAnchor(element: Element | null): Element | null {
  while (element !== null && element.tagName) {
    if (element.tagName.toUpperCase() === 'A') {
      return element;
    }
    element = element.parentElement;
  }

  return null;
}
