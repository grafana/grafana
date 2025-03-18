import { css, cx } from '@emotion/css';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

interface Props {
  label: React.ReactNode;
  className?: string;
  horizontal?: boolean;
  childrenWrapperClassName?: string;
}

export const DetailsField = ({
  className,
  label,
  horizontal,
  children,
  childrenWrapperClassName,
}: React.PropsWithChildren<Props>) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={cx(styles.field, horizontal ? styles.fieldHorizontal : styles.fieldVertical, className)}>
      <div>{label}</div>
      <div className={childrenWrapperClassName}>{children}</div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  fieldHorizontal: css({
    flexDirection: 'row',
    [theme.breakpoints.down('md')]: {
      flexDirection: 'column',
    },
  }),
  fieldVertical: css({
    flexDirection: 'column',
  }),
  field: css({
    display: 'flex',
    margin: `${theme.spacing(2)} 0`,

    '& > div:first-child': {
      width: '110px',
      paddingRight: theme.spacing(1),
      fontSize: theme.typography.size.sm,
      fontWeight: theme.typography.fontWeightBold,
      lineHeight: 1.8,
    },
    '& > div:nth-child(2)': {
      flex: 1,
      color: theme.colors.text.secondary,
    },
  }),
});
