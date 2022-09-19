import React, { FC, HTMLAttributes, RefCallback } from 'react';

import { NavModel, NavModelItem, PageLayoutType } from '@grafana/data';

import { PageHeader } from '../PageHeader/PageHeader';

import { OldNavOnly } from './OldNavOnly';
import { PageContents } from './PageContents';

export interface PageProps extends HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  navId?: string;
  navModel?: NavModel;
  pageNav?: NavModelItem;
  subTitle?: React.ReactNode;
  layout?: PageLayoutType;
  /** Something we can remove when we remove the old nav. */
  toolbar?: React.ReactNode;
  /** Can be used to get the scroll container element to access scroll position */
  scrollRef?: RefCallback<HTMLDivElement>;
  /** Can be used to update the current scroll position */
  scrollTop?: number;
}

export interface PageType extends FC<PageProps> {
  Header: typeof PageHeader;
  OldNavOnly: typeof OldNavOnly;
  Contents: typeof PageContents;
}
