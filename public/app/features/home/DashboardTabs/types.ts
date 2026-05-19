import { type IconName } from '@grafana/data';

export interface HomepageTab {
  id: string;
  label: string;
  activeLabel?: string;
  icon?: IconName;
  /** Tab is a link (rendered right-aligned) */
  href?: string;
  /** Item count shown as badge on the tab */
  counter?: number;
}

export interface HomepageTabExtensionProps {
  active: boolean;
  register: (tab: HomepageTab) => () => void;
}

export const isHomepageTab = (obj: unknown): obj is HomepageTab => {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  if (!('id' in obj) || typeof obj.id !== 'string') {
    return false;
  }

  if (!('label' in obj) || typeof obj.label !== 'string') {
    return false;
  }

  if ('activeLabel' in obj && obj.activeLabel !== undefined && typeof obj.activeLabel !== 'string') {
    return false;
  }

  if ('icon' in obj && obj.icon !== undefined && typeof obj.icon !== 'string') {
    return false;
  }

  if ('href' in obj && obj.href !== undefined && typeof obj.href !== 'string') {
    return false;
  }

  if ('counter' in obj && obj.counter !== undefined && typeof obj.counter !== 'number') {
    return false;
  }

  return true;
};
