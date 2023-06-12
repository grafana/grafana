import { cx, css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';

export interface Props {
  grow?: boolean;
  className?: string;
}

/** @beta */
export const InlineSegmentGroup = ({ children, className, grow, ...htmlProps }: React.PropsWithChildren<Props>) => {
  const styles = useStyles2((theme) => getStyles(theme, grow));

  return (
    <div className={cx(styles.container, className)} {...htmlProps}>
      {children}
    </div>
  );
};

InlineSegmentGroup.displayName = 'InlineSegmentGroup';

const getStyles = (theme: GrafanaTheme2, grow?: boolean) => {
  return {
    container: css`
      display: flex;
      flex-direction: row;
      align-items: flex-start;
      text-align: left;
      position: relative;
      flex: ${grow ? 1 : 0} 0 auto;
      margin-bottom: ${theme.spacing(0.5)};
    `,
  };
};
