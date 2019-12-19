import React, { FC } from 'react';
import { NavModelItem } from '@grafana/data';
import { useTheme } from '../../themes';
import { getTabsStyle } from './styles';
import { TabLink } from './TabLink';
import { TabItem } from './TabItem';

export interface Props {
  main: NavModelItem;
  customCss?: string;
  onChangeTab?: (id: number) => void;
}

export const Tabs: FC<Props> = ({ main, onChangeTab, customCss }) => {
  const theme = useTheme();
  const tabsStyles = getTabsStyle(theme);
  const hasOnChange = !!onChangeTab;

  return (
    <ul className={`${tabsStyles.tabs} ${customCss && customCss}`}>
      {main.children?.map((tab: NavModelItem, index: number) => {
        if (tab.hideFromTabs) {
          return null;
        }

        return (
          <li className={tabsStyles.tabItem} key={`${tab.url}-${index}`}>
            {tab.url && <TabLink tab={tab} />}
            {hasOnChange && <TabItem tab={tab} index={index} onChangeTab={onChangeTab} />}
          </li>
        );
      })}
    </ul>
  );
};
