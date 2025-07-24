import pluralize from 'pluralize';
import { Fragment } from 'react';
import * as React from 'react';

import { t } from '@grafana/i18n';
import { Badge, Stack } from '@grafana/ui';

interface Props {
  active?: number;
  suppressed?: number;
  unprocessed?: number;
}

export const AlertGroupsSummary = ({ active = 0, suppressed = 0, unprocessed = 0 }: Props) => {
  const statsComponents: React.ReactNode[] = [];
  const total = active + suppressed + unprocessed;

  if (active) {
    statsComponents.push(
      <Badge
        color="red"
        key="firing"
        text={t('alerting.alert-groups-summary.text-firing', '{{count}} firing', { count: active })}
      />
    );
  }

  if (suppressed) {
    statsComponents.push(
      <Badge
        color="blue"
        key="suppressed"
        text={t('alerting.alert-groups-summary.text-suppressed', '{{count}} suppressed', { count: suppressed })}
      />
    );
  }

  if (unprocessed) {
    statsComponents.push(
      <Badge
        color="orange"
        key="unprocessed"
        text={t('alerting.alert-groups-summary.text-unprocessed', '{{count}} unprocessed', { count: unprocessed })}
      />
    );
  }

  // if we only have one category it's not really necessary to repeat the total
  if (statsComponents.length > 1) {
    statsComponents.unshift(
      <Fragment key="total">
        {total} {pluralize('instance', total)}
      </Fragment>
    );
  }

  const hasStats = Boolean(statsComponents.length);

  return hasStats ? <Stack gap={0.5}>{statsComponents}</Stack> : null;
};
