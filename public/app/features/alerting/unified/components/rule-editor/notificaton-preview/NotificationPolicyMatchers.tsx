import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Text, useStyles2 } from '@grafana/ui';
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
    return <div className={styles.defaultPolicy}>Default policy</div>;
  } else if (hasEmptyMatchers(route)) {
    return (
      <Text variant="bodySmall" color="secondary">
        <Trans i18nKey="alerting.policies.no-matchers">No matchers</Trans>
      </Text>
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
});
