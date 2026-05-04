import { useState } from 'react';

import { type RouteMatchResult, type RouteWithID } from '@grafana/alerting';
import { Trans } from '@grafana/i18n';
import { Button } from '@grafana/ui';

import { NotificationPolicySidebar } from './NotificationPolicySidebar';

type NotificationPolicyDrawerProps = {
  policyName?: string;
  matchedRootRoute: boolean;
  journey: RouteMatchResult<RouteWithID>['matchingJourney'];
  labels: Array<[string, string]>;
};

export function NotificationPolicyDrawer({
  policyName,
  matchedRootRoute,
  journey,
  labels,
}: NotificationPolicyDrawerProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  return (
    <>
      <Button fill="outline" variant="secondary" size="sm" onClick={() => setIsDrawerOpen(true)}>
        <Trans i18nKey="alerting.instance-match.notification-policy">View route</Trans>
      </Button>

      {isDrawerOpen && (
        <NotificationPolicySidebar
          journeys={[{ journey, policyName }]}
          labels={labels}
          onClose={() => setIsDrawerOpen(false)}
        />
      )}
    </>
  );
}
