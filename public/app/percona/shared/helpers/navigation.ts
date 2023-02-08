import { NavModelItem } from '@grafana/data';

export function sortWithSubsections(items: NavModelItem[]): NavModelItem[] {
  if (!items.some((i) => i.isSubheader) || !items.some((i) => i.divider)) {
    return items;
  }

  const sections: NavModelItem[][] = [];
  let current: NavModelItem[] = [];

  items.forEach((item) => {
    current.push(item);

    if (item.divider) {
      sections.push(current);
      current = [];
    }
  });

  if (current.length) {
    sections.push(current);
  }

  const sorted: NavModelItem[] = [];

  sections.forEach((section) => {
    const header = section.find((i) => i.isSubheader);
    const items = section.filter((i) => !i.isSubheader);

    if (header) {
      sorted.push(header, ...items);
    } else {
      sorted.push(...items);
    }
  });

  return sorted;
}
