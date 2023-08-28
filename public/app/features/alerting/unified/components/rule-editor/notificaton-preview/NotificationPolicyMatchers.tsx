import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { Matchers } from '../../notification-policies/Matchers';

import { hasEmptyMatchers, isDefaultPolicy, RouteWithPath } from './route';

export function NotificationPolicyMatchers({ route }: { route: RouteWithPath }) {
  const styles = useStyles2(getStyles);
  if (isDefaultPolicy(route)) {
    return <div className={styles.defaultPolicy}>Default policy</div>;
  } else if (hasEmptyMatchers(route)) {
    return <div className={styles.textMuted}>No matchers</div>;
  } else {
    return <Matchers matchers={route.object_matchers ?? []} />;
  }
}

const getStyles = (theme: GrafanaTheme2) => ({
  defaultPolicy: css`
    padding: ${theme.spacing(0.5)};
    background: ${theme.colors.background.secondary};
    width: fit-content;
  `,
  textMuted: css`
    color: ${theme.colors.text.secondary};
  `,
});
