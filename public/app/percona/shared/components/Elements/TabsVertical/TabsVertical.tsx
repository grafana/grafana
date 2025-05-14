import { FC, PropsWithChildren, ReactNode } from 'react';

import { useTheme } from '@grafana/ui';

import { getStyles } from './TabsVertical.styles';

export interface TabsVerticalProps extends PropsWithChildren {
  children: ReactNode;
  className?: string;
  dataTestId?: string;
}

export const TabsVertical: FC<TabsVerticalProps> = ({ children, className, dataTestId }) => {
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
