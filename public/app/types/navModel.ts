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
  breadcrumbs?: NavModelItem[];
  target?: string;
}

export interface NavModel {
  main: NavModelItem;
  node: NavModelItem;
}
