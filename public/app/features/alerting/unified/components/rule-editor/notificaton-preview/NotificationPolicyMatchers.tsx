import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { MatcherFormatter } from '../../../utils/matchers';
import { Matchers } from '../../notification-policies/Matchers';

import { RouteWithPath, hasEmptyMatchers, isDefaultPolicy } from './route';

interface Props {
  route: RouteWithPath;
  matcherFormatter: MatcherFormatter;
}

export function NotificationPolicyMatchers({ route, matcherFormatter }: Props) {
  const styles = useStyles2(getStyles);
  if (isDefaultPolicy(route)) {
    return <div className={styles.defaultPolicy}>Default policy</div>;
  } else if (hasEmptyMatchers(route)) {
    return <div className={styles.textMuted}>No matchers</div>;
  } else {
    return <Matchers matchers={route.object_matchers ?? []} formatter={matcherFormatter} />;
  }
}

const getStyles = (theme: GrafanaTheme2) => ({
  defaultPolicy: css({
    padding: theme.spacing(0.5),
    background: theme.colors.background.secondary,
    width: 'fit-content',
  }),
  textMuted: css({
    color: theme.colors.text.secondary,
  }),
});
