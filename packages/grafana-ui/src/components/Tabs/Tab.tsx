import React, { FC } from 'react';
import { cx } from 'emotion';
import { Icon } from '..';
import { useTheme } from '../../themes';
import { IconType } from '../Icon/types';
import { getTabsStyle } from './styles';

export interface TabProps {
  label: string;
  active?: boolean;
  icon?: IconType;
  onChangeTab: () => void;
}

export const Tab: FC<TabProps> = ({ label, active, icon, onChangeTab }) => {
  const theme = useTheme();
  const tabsStyles = getTabsStyle(theme);

  return (
    <li className={cx(tabsStyles.tabItem, active && tabsStyles.activeStyle)} onClick={onChangeTab}>
      {icon && <Icon name={icon} />}
      {label}
    </li>
  );
};
