import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

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
    return (
      <div className={styles.defaultPolicy}>
        <Trans i18nKey="alerting.notification-policy-matchers.default-policy">Default policy</Trans>
      </div>
    );
  } else if (hasEmptyMatchers(route)) {
    return (
      <div className={styles.textMuted}>
        <Trans i18nKey="alerting.notification-policy-matchers.no-matchers">No matchers</Trans>
      </div>
    );
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
