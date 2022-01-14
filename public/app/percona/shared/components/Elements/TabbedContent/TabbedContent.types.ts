import { FC } from 'react';

export enum TabOrientation {
  Vertical = 'vertical',
  Horizontal = 'horizontal',
}
export interface ContentTab {
  label: string;
  key: string;
  disabled?: boolean;
  hidden?: boolean;
  component: JSX.Element;
}

export interface TabComponentMap {
  id: string;
  component: JSX.Element;
}

interface ContentProps {
  className?: string;
}

export interface TabRenderProps {
  Content: FC<ContentProps>;
  tab?: ContentTab;
}

export interface TabbedContentProps {
  tabs: ContentTab[];
  basePath: string;
  orientation?: TabOrientation;
  className?: string;
  tabsdataTestId?: string;
  contentdataTestId?: string;
  renderTab?: (props: TabRenderProps) => void;
}
