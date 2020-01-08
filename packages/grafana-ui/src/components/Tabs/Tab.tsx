import React, { FC, ReactNode } from 'react';
import { cx } from 'emotion';
import { useTheme } from '../../themes';
import { getTabsStyle } from './styles';

export interface TabProps {
  label: string;
  active?: boolean;
  icon?: ReactNode;
  onChangeTab: () => void;
}

export const Tab: FC<TabProps> = ({ label, active, icon, onChangeTab }) => {
  const theme = useTheme();
  const tabsStyles = getTabsStyle(theme);

  return (
    <li className={tabsStyles.tabItem}>
      <div onClick={onChangeTab} className={cx(tabsStyles.linkItem, active && tabsStyles.activeStyle)}>
        {icon}
        {label}
      </div>
    </li>
  );
};
