import { ContentTab, TabOrientation } from '../TabbedContent.types';

export interface OrientedTabsProps {
  orientation?: TabOrientation;
  tabs: ContentTab[];
  activeTabKey?: string;
  className?: string;
  dataTestId?: string;
  tabClick?: (key: string) => void;
}

export interface OrientedTabContentProps {
  tabs: ContentTab[];
  activeTabKey?: string;
  tabClick?: (key: string) => void;
}
