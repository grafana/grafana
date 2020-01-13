import React, { FC, ReactNode } from 'react';
import { useTheme } from '../../themes';
import { getTabsStyle } from './styles';

interface Props {
  children: ReactNode;
}

export const TabContent: FC<Props> = ({ children }) => {
  const theme = useTheme();
  const styles = getTabsStyle(theme);

  return <div className={styles.tabContent}>{children}</div>;
};
