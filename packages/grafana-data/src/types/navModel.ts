export interface NavModelItem {
  text: string;
  url?: string;
  subTitle?: string;
  icon?: string;
  img?: string;
  id?: string;
  active?: boolean;
  hideFromTabs?: boolean;
  hideFromMenu?: boolean;
  divider?: boolean;
  children?: NavModelItem[];
  breadcrumbs?: NavModelBreadcrumb[];
  target?: string;
  parentItem?: NavModelItem;
  showOrgSwitcher?: boolean;
}

/**
 *  Interface used to describe  different kinds of page titles and page navigation. Navmodels are usually generated in the backend and stored in Redux.
 */
export interface NavModel {
  /**
   *  Main page. that wraps the navigation. Generate the `children` property generate tabs when used with the Page component.
   */
  main: NavModelItem;
  /**
   *   This is the current active tab/navigation.
   */
  node: NavModelItem;
  /**
   *  Describes breadcrumbs that are used in places such as data source settings., folder page and plugins page.
   */
  breadcrumbs?: NavModelItem[];
}

export interface NavModelBreadcrumb {
  title: string;
  url?: string;
}

export type NavIndex = { [s: string]: NavModelItem };
