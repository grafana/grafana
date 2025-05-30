import { css, cx } from '@emotion/css';
import { HTMLAttributes, ReactNode } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';

interface Props extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export const TabContent = ({ children, className, ...restProps }: Props) => {
  const styles = useStyles2(getTabContentStyle);

  return (
    <div {...restProps} className={cx(styles.tabContent, className)}>
      {children}
    </div>
  );
};

const getTabContentStyle = (theme: GrafanaTheme2) => ({
  tabContent: css({
    background: theme.colors.background.primary,
  }),
});
