import { type PanelStatusItem } from '@grafana/data';

type DisplayItem = Pick<PanelStatusItem, 'severity' | 'text'> & Partial<PanelStatusItem>;

/** Group presentation only; member identities still own callbacks and Assistant policy. */
export function groupPanelStatusItems<T extends DisplayItem>(items: readonly T[]): T[][] {
  const groups: T[][] = [];
  const notices = new Map<string, T[]>();
  for (const item of items) {
    if (item.origin !== 'notice' || item.actions?.length) {
      groups.push([item]);
      continue;
    }
    const key = JSON.stringify([item.severity, item.text, item.link]);
    const group = notices.get(key);
    if (group) {
      group.push(item);
    } else {
      const members = [item];
      notices.set(key, members);
      groups.push(members);
    }
  }
  return groups;
}
