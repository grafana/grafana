import { IconName } from '@grafana/ui';

export interface CommandPaletteDividerItem {
  type: 'divider';
  title: string;
}

export interface CommandPaletteResultItem {
  type: 'result';
  title: string;
  uid?: string;
  subtitle?: string;
  parentTitle?: string;
  parentIcon?: IconName;
  icon: IconName;
  action?: () => void;
}

export type CommandPaletteItem = CommandPaletteDividerItem | CommandPaletteResultItem;
