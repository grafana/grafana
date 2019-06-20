import { NavModel, NavModelItem } from '@grafana/data';

export const backendSrv = {
  get: jest.fn(),
  getDashboard: jest.fn(),
  getDashboardByUid: jest.fn(),
  getFolderByUid: jest.fn(),
  post: jest.fn(),
};

export function createNavTree(...args: any[]) {
  const root: any[] = [];
  let node = root;
  for (const arg of args) {
    const child: any = { id: arg, url: `/url/${arg}`, text: `${arg}-Text`, children: [] };
    node.push(child);
    node = child.children;
  }

  return root;
}

export function createNavModel(title: string, ...tabs: string[]): NavModel {
  const node: NavModelItem = {
    id: title,
    text: title,
    icon: 'fa fa-fw fa-warning',
    subTitle: 'subTitle',
    url: title,
    children: [],
    breadcrumbs: [],
  };

  for (const tab of tabs) {
    node.children.push({
      id: tab,
      icon: 'icon',
      subTitle: 'subTitle',
      url: title,
      text: title,
      active: false,
    });
  }

  node.children[0].active = true;

  return {
    node: node,
    main: node,
  };
}
