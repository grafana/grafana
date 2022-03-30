import React, { HTMLAttributes, useEffect } from 'react';
import { css, cx } from '@emotion/css';
import { useStyles2 } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';
import { reportExperimentView } from '@grafana/runtime';

export interface Props extends HTMLAttributes<HTMLSpanElement> {
  text?: string;
  experimentId?: string;
}

export const ProBadge = ({ text = 'PRO', className, experimentId, ...htmlProps }: Props) => {
  const styles = useStyles2(getStyles);

  useEffect(() => {
    if (experimentId) {
      reportExperimentView(experimentId, 'test', '');
    }
  }, [experimentId]);

  return (
    <span className={cx(styles.badge, className)} {...htmlProps}>
      {text}
    </span>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    badge: css`
      margin-left: ${theme.spacing(1.25)};
      border-radius: ${theme.shape.borderRadius(5)};
      background-color: ${theme.colors.success.main};
      padding: ${theme.spacing(0.25, 0.75)};
      color: ${theme.colors.text.maxContrast};
      font-weight: ${theme.typography.fontWeightMedium};
      font-size: ${theme.typography.pxToRem(10)};
    `,
  };
};
