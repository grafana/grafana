import { NavModelItem } from '@grafana/data';

export const settingsExtensions: Map<string, { nav: NavModelItem; element: JSX.Element }> = new Map();

export function addSettingsPage(pageNav: NavModelItem, element: JSX.Element) {
  if (!pageNav.id) {
    console.warn('Unable to add settings page, PageNav must have an id');
    return;
  }
  settingsExtensions.set(pageNav.id, { nav: pageNav, element });
}
