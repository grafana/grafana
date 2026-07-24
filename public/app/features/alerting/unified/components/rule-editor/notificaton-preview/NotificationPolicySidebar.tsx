import { useMemo } from 'react';

import { isDefaultRoutingTreeName } from '@grafana/alerting';
import { Trans } from '@grafana/i18n';
import { Drawer, Text } from '@grafana/ui';

import { type JourneyEntry, NotificationPolicyContent } from './NotificationPolicyDrawer';

type NotificationPolicySidebarProps = {
  journeys: JourneyEntry[];
  labels: Array<[string, string]>;
  onClose: () => void;
};

export function NotificationPolicySidebar({ journeys, labels, onClose }: NotificationPolicySidebarProps) {
  // The default tree may be named "user-defined" or "default"; treat either as no name
  // so downstream rendering shows "Default policy" rather than the internal identifier.
  const normalizedJourneys = useMemo(
    () =>
      journeys.map(({ journey, policyName }) => ({
        journey,
        policyName: isDefaultRoutingTreeName(policyName) ? undefined : policyName,
      })),
    [journeys]
  );

  if (normalizedJourneys.length === 0) {
    return null;
  }

  const isSingleJourney = normalizedJourneys.length === 1;

  return (
    <Drawer
      size="md"
      title={
        isSingleJourney ? (
          <>
            <Trans i18nKey="alerting.notification-route.notification-policy">Notification policy</Trans>
            {normalizedJourneys[0].policyName && (
              <Text color="secondary" variant="bodySmall">
                {' '}
                ⋅ {normalizedJourneys[0].policyName}
              </Text>
            )}
          </>
        ) : (
          <Trans i18nKey="alerting.notification-route.notification-policies">Notification policies</Trans>
        )
      }
      onClose={onClose}
    >
      <NotificationPolicyContent journeys={journeys} labels={labels} />
    </Drawer>
  );
}
