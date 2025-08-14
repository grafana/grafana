import { Trans } from '@grafana/i18n';
import { Text } from '@grafana/ui';
import { ObjectMatcher } from 'app/plugins/datasource/alertmanager/types';

import { MatcherFormatter } from '../../../utils/matchers';
import { Matchers } from '../../notification-policies/Matchers';

interface Props {
  matchers?: ObjectMatcher[];
  matcherFormatter: MatcherFormatter;
}

export function NotificationPolicyMatchers({ matchers = [], matcherFormatter }: Props) {
  if (matchers.length === 0) {
    return (
      <Text variant="bodySmall" color="secondary">
        <Trans i18nKey="alerting.notification-policy-matchers.no-matchers">No matchers</Trans>
      </Text>
    );
  } else {
    return <Matchers matchers={matchers} formatter={matcherFormatter} />;
  }
}
