export interface NavModelBreadcrumb {
  title: string;
  url?: string;
}

export interface NavModelItem {
  text: string;
  url?: string;
  subTitle?: string;
  subType?: any; // ??? icon and text
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
}

export type NavIndex = { [s: string]: NavModelItem };
