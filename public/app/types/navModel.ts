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
  target?: string;
}

export interface NavModel {
  breadcrumbs: NavModelItem[];
  main: NavModelItem;
  node: NavModelItem;
}
