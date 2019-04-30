export interface NavModelItem {
  text: string;
  url?: string;
  subTitle?: string;
  icon?: string;
  img?: string;
  id?: string;
  active?: boolean;
  hideFromTabs?: boolean;
  divider?: boolean;
  children?: NavModelItem[];
  breadcrumbs?: NavModelBreadcrumb[];
  target?: string;
  parentItem?: NavModelItem;
}

export interface NavModel {
  main: NavModelItem;
  node: NavModelItem;
  breadcrumbs?: NavModelItem[];
}

export interface NavModelBreadcrumb {
  title: string;
  url?: string;
}

export type NavIndex = { [s: string]: NavModelItem };
