import { css, cx } from '@emotion/css';
import { type HTMLAttributes, useEffect } from 'react';

import type { GrafanaTheme2 } from '@grafana/data/themes';
import { reportExperimentView } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui/themes';

import { OrangeBadge } from '../Branding/OrangeBadge';

export interface Props extends HTMLAttributes<HTMLSpanElement> {
  experimentId?: string;
  eventVariant?: string;
}

export const ProBadge = ({ className, experimentId, eventVariant = '', ...htmlProps }: Props) => {
  const styles = useStyles2(getStyles);

  useEffect(() => {
    if (experimentId) {
      reportExperimentView(experimentId, 'test', eventVariant);
    }
  }, [experimentId, eventVariant]);

  return <OrangeBadge className={cx(styles.badge, className)} {...htmlProps} />;
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    badge: css({
      marginLeft: theme.spacing(1.25),
    }),
  };
};
