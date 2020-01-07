import React, { FC } from 'react';
import { cx } from 'emotion';
import { useTheme } from '../../themes';
import { getTabsStyle } from './styles';
import { Tab } from './types';

export interface Props {
  tabs: Tab[];
  onChangeTab: (tabIndex: number) => void;
  className?: string;
}

export const TabsNavigation: FC<Props> = ({ className, onChangeTab, tabs }) => {
  const theme = useTheme();
  const tabsStyles = getTabsStyle(theme);

  return (
    <ul className={`${cx(tabsStyles.tabs, className)}`}>
      {tabs.map((tab, index) => {
        if (tab.hide) {
          return null;
        }

        return (
          <li className={tabsStyles.tabItem} key={`${tab.key}-${index}`}>
            <div
              onClick={() => onChangeTab(index)}
              className={cx(tabsStyles.linkItem, tab.active && tabsStyles.activeStyle)}
            >
              {tab.label}
            </div>
          </li>
        );
      })}
    </ul>
  );
};
