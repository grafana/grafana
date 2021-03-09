import React, { FC } from 'react';
import { Collapse, useStyles } from '@grafana/ui';
import { css, cx } from 'emotion';
import { GrafanaTheme } from '@grafana/data';

interface Props extends Omit<React.ComponentProps<typeof Collapse>, 'label'> {
  labelLeft: React.ReactNode;
  labelRight: React.ReactNode;
}

export const RuleCollapse: FC<Props> = ({ labelLeft, labelRight, className, children, ...baseProps }) => {
  const styles = useStyles(getStyles);
  const label: React.ReactNode = (
    <div className={styles.label}>
      {labelLeft}
      {labelRight}
    </div>
  );

  return (
    <Collapse className={cx(styles.collapse, className)} label={label} {...baseProps}>
      {children}
    </Collapse>
  );
};

const getStyles = (theme: GrafanaTheme) => ({
  collapse: css`
    & > div:first-child {
      background-color: ${theme.colors.bg2};
    }
    & > div > div + div {
      flex: 1;
    }
  `,
  label: css`
    display: flex;
    justify-content: space-between;
  `,
});
