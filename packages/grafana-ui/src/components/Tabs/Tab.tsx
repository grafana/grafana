import React, { FC } from 'react';
import { cx } from 'emotion';
import { useTheme } from '../../themes';
import { getTabsStyle } from './styles';

export interface TabProps {
  label: string;
  active?: boolean;
  icon?: string;
  onChangeTab: () => void;
}

export const Tab: FC<TabProps> = ({ label, active, icon, onChangeTab }) => {
  const theme = useTheme();
  const tabsStyles = getTabsStyle(theme);

  return (
    <li className={cx(tabsStyles.tabItem, active && tabsStyles.activeStyle)} onClick={onChangeTab}>
      {icon && <i className={icon} />}
      {label}
    </li>
  );
};
