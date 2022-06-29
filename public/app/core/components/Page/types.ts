import { FC, HTMLAttributes } from 'react';

import { NavModel, NavModelItem } from '@grafana/data';

import { PageHeader } from '../PageHeader/PageHeader';

import { PageContents } from './PageContents';

export interface PageProps extends HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  navId?: string;
  navModel?: NavModel;
  pageNav?: NavModelItem;
}

export interface PageType extends FC<PageProps> {
  Header: typeof PageHeader;
  Contents: typeof PageContents;
}
