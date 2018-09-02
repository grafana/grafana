import { NavModel, NavModelItem } from 'app/types';

export const backendSrv = {
  get: jest.fn(),
  getDashboard: jest.fn(),
  getDashboardByUid: jest.fn(),
  getFolderByUid: jest.fn(),
  post: jest.fn(),
};

export function createNavTree(...args) {
  const root = [];
  let node = root;
  for (const arg of args) {
    const child = { id: arg, url: `/url/${arg}`, text: `${arg}-Text`, children: [] };
    node.push(child);
    node = child.children;
  }

  return root;
}

export function getNavModel(title: string, tabs: string[]): NavModel {
  const node: NavModelItem = {
    id: title,
    text: title,
    icon: 'fa fa-fw fa-warning',
    subTitle: 'subTitle',
    url: title,
    children: [],
    breadcrumbs: [],
  };

  for (let tab of tabs) {
    node.children.push({
      id: tab,
      icon: 'icon',
      subTitle: 'subTitle',
      url: title,
      text: title,
    });
  }

  return {
    node: node,
    main: node,
  };
}
