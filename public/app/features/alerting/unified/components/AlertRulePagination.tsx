import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data/src';
import { Pagination, useStyles2 } from '@grafana/ui';

interface Props extends React.ComponentPropsWithoutRef<typeof Pagination> {}

export const AlertRulePagination = ({ className, ...props }: Props) => {
  const styles = useStyles2(getStyles);
  return <Pagination className={cx(styles.wrapper, className)} {...props} />;
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    float: none;
    display: flex;
    justify-content: flex-start;
    margin: ${theme.spacing(2, 0)};
  `,
});
