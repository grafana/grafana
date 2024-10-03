import { FC, HTMLAttributes } from 'react';
import * as React from 'react';

import { NavModel, NavModelItem, PageLayoutType } from '@grafana/data';

import { ScrollRefElement } from '../NativeScrollbar';

import { PageContents } from './PageContents';

export interface PageProps extends HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  navId?: string;
  navModel?: NavModel;
  pageNav?: NavModelItem;
  /** Can be used to place info inline with the heading */
  info?: PageInfoItem[];
  /** Can be used to place actions inline with the heading */
  actions?: React.ReactNode;
  onEditTitle?: (newValue: string) => Promise<void>;
  /** Can be used to customize rendering of title */
  renderTitle?: (title: string) => React.ReactNode;
  /** Can be used to customize or customize and set a page sub title */
  subTitle?: React.ReactNode;
  /** Control the page layout. */
  layout?: PageLayoutType;
  /** Can be used to get the scroll container element to access scroll position */
  onSetScrollRef?: (ref: ScrollRefElement) => void;
  /** Set a page-level toolbar */
  toolbar?: React.ReactNode;
}

export interface PageInfoItem {
  label: string;
  value: React.ReactNode;
}

export interface PageType extends FC<PageProps> {
  Contents: typeof PageContents;
}
