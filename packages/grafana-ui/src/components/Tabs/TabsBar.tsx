import React, { FC, ReactNode } from 'react';
import { useTheme } from '../../themes';
import { getTabsStyle } from './styles';

export interface Props {
  /** Children should be a single <Tab /> or an array of <Tab /> */
  children: ReactNode;
}

export const TabsBar: FC<Props> = ({ children }) => {
  const theme = useTheme();
  const tabsStyles = getTabsStyle(theme);

  return <ul className={tabsStyles.tabs}>{children}</ul>;
};
