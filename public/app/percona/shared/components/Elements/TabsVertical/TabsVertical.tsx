import React, { FC, ReactNode } from 'react';
import { useTheme } from '@grafana/ui';
import { getStyles } from './TabsVertical.styles';

export interface TabsVerticalProps {
  children: ReactNode;
  className?: string;
  dataQa?: string;
}

export const TabsVertical: FC<TabsVerticalProps> = ({ children, className, dataQa }) => {
  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <div className={className}>
      <ul data-qa={dataQa} className={styles.tabs}>
        {children}
      </ul>
    </div>
  );
};
