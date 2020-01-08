import React, { FC, ReactElement } from 'react';
import { cx } from 'emotion';
import { useTheme } from '../../themes';
import { getTabsStyle } from './styles';
import { TabProps } from './Tab';

export interface Props {
  /** Children should be a single <Tab /> or an array of <Tab /> */
  children: ReactElement<TabProps> | Array<ReactElement<TabProps>>;
  /** Provide a className if you wish to change the layout of the TabBar */
  className?: string;
}

export const TabBar: FC<Props> = ({ children, className }) => {
  const theme = useTheme();
  const tabsStyles = getTabsStyle(theme);

  return <ul className={`${cx(tabsStyles.tabs, className)}`}>{children}</ul>;
};
