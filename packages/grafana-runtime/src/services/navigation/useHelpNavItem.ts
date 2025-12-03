import { NavModelItem } from '@grafana/data';

export type UseHelpNavItem = () => NavModelItem | undefined;

let singleton: UseHelpNavItem | undefined;

export function setHelpNavItemHook(hook: UseHelpNavItem): void {
  // We allow overriding the registry in tests
  if (singleton && process.env.NODE_ENV !== 'test') {
    throw new Error('setHelpNavItemHook() function should only be called once, when Grafana is starting.');
  }
  singleton = hook;
}

export function useHelpNavItem(): NavModelItem | undefined {
  if (!singleton) {
    throw new Error('useHelpNavItem() can only be used after the Grafana instance has started.');
  }
  return singleton();
}
