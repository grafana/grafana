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
    icon: 'exclamation-triangle',
    subTitle: 'subTitle',
    url: title,
    children: [],
    breadcrumbs: [],
  };

  const children: NavModelItem[] = [];

  for (const tab of tabs) {
    children.push({
      id: tab,
      subTitle: 'subTitle',
      url: title,
      text: title,
      active: false,
    });
  }

  children[0].active = true;

  node.children = children;

  return {
    node: node,
    main: node,
  };
}
