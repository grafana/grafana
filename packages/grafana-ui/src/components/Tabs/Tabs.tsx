import React, { FC } from 'react';
import { NavModelItem } from '@grafana/data';
import { useTheme } from '../../themes';
import { getTabsStyle } from './styles';
import { cx } from 'emotion';

export interface Props {
  main: NavModelItem;
  customCss?: string;
  onChangeTab: (id: number) => void;
}

export const Tabs: FC<Props> = ({ main, onChangeTab, customCss }) => {
  const theme = useTheme();
  const tabsStyles = getTabsStyle(theme);

  return (
    <ul className={`${tabsStyles.tabs} ${customCss && customCss}`}>
      {main.children?.map((tab: NavModelItem, index: number) => {
        if (tab.hideFromTabs) {
          return null;
        }

        return (
          <li className={tabsStyles.tabItem} key={`${tab.url}-${index}`}>
            <div
              onClick={() => onChangeTab(index)}
              className={cx(tabsStyles.linkItem, tab.active && tabsStyles.activeStyle)}
            >
              {tab.text}
            </div>
          </li>
        );
      })}
    </ul>
  );
};
