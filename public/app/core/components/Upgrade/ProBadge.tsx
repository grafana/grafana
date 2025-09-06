import { css, cx } from '@emotion/css';
import { HTMLAttributes, useEffect } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { reportExperimentView } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';

import { OrangeBadge } from '../Branding/OrangeBadge';

export interface Props extends HTMLAttributes<HTMLSpanElement> {
  text?: string;
  experimentId?: string;
  eventVariant?: string;
}

export const ProBadge = ({ text = 'PRO', className, experimentId, eventVariant = '', ...htmlProps }: Props) => {
  const styles = useStyles2(getStyles);

  const test = true;

  useEffect(() => {
    if (experimentId) {
      reportExperimentView(experimentId, 'test', eventVariant);
    }
  }, [experimentId, eventVariant]);

  if (test) {
    return <OrangeBadge className={styles.badge} />;
  }

  return (
    <span className={cx(styles.badge, className)} {...htmlProps}>
      {text}
    </span>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    badge: css({
      marginLeft: theme.spacing(1.25),
      // borderRadius: theme.shape.borderRadius(5),
      // backgroundColor: theme.colors.success.main,
      // padding: theme.spacing(0.25, 0.75),
      // color: 'white', // use the same color for both themes
      // fontWeight: theme.typography.fontWeightMedium,
      // fontSize: theme.typography.pxToRem(10),
    }),
  };
};
