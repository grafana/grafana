import { css, cx } from '@emotion/css';
import { HTMLProps, ReactNode } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';

export interface Props extends Omit<HTMLProps<HTMLDivElement>, 'css'> {
  children: ReactNode | ReactNode[];
}

export const InlineFieldRow = ({ children, className, ...htmlProps }: Props) => {
  const styles = useStyles2(getStyles);
  return (
    <div className={cx(styles.container, className)} {...htmlProps}>
      {children}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      label: 'InlineFieldRow',
      display: 'flex',
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignContent: 'flex-start',
      rowGap: theme.spacing(0.5),
      maxWidth: '100%',
    }),
  };
};
