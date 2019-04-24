export interface NavModelItem {
  text: string;
  url: string;
  subTitle?: string;
  icon?: string;
  img?: string;
  id: string;
  active?: boolean;
  hideFromTabs?: boolean;
  divider?: boolean;
  children?: NavModelItem[];
  breadcrumbs?: Array<{ title: string; url: string }>;
  target?: string;
  parentItem?: NavModelItem;
}

export interface NavModel {
  main: NavModelItem;
  node: NavModelItem;
}

export type NavIndex = { [s: string]: NavModelItem };
