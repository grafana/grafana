import React, { FC } from 'react';
import { cx, css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { useTheme } from '../../themes';

export interface Props {
  grow?: boolean;
  className?: string;
}

/** @beta */
export const InlineSegmentGroup: FC<Props> = ({ children, className, grow, ...htmlProps }) => {
  const theme = useTheme();
  const styles = getStyles(theme, grow);

  return (
    <div className={cx(styles.container, className)} {...htmlProps}>
      {children}
    </div>
  );
};

InlineSegmentGroup.displayName = 'InlineSegmentGroup';

const getStyles = (theme: GrafanaTheme, grow?: boolean) => {
  return {
    container: css`
      display: flex;
      flex-direction: row;
      align-items: flex-start;
      text-align: left;
      position: relative;
      flex: ${grow ? 1 : 0} 0 auto;
      margin-bottom: ${theme.spacing.xs};
    `,
  };
};
