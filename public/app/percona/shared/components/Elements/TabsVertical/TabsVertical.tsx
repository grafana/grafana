import React, { FC, ReactNode } from 'react';

import { useTheme } from '@grafana/ui';

import { getStyles } from './TabsVertical.styles';

export interface TabsVerticalProps {
  children: ReactNode;
  className?: string;
  dataTestId?: string;
}

export const TabsVertical: FC<React.PropsWithChildren<TabsVerticalProps>> = ({ children, className, dataTestId }) => {
  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <div className={className}>
      <ul data-testid={dataTestId} className={styles.tabs}>
        {children}
      </ul>
    </div>
  );
};
