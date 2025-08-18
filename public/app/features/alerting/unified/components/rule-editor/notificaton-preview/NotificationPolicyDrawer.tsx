import { Fragment, useState } from 'react';

import { RouteMatchResult, RouteWithID } from '@grafana/alerting/unstable';
import { Trans } from '@grafana/i18n';
import { Button, Drawer, Text, TextLink } from '@grafana/ui';

import { Stack } from '../../../../../../plugins/datasource/parca/QueryEditor/Stack';
import { createRelativeUrl } from '../../../utils/url';
import { Label } from '../../Label';

import { ConnectionLine } from './ConnectionLine';
import { JourneyPolicyCard } from './JourneyPolicyCard';
import { MatchDetails } from './MatchDetails';

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

  const handleOpenDrawer = () => {
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
  };

  // Process the journey data to extract the information we need
  const finalRouteMatchInfo = journey.at(-1);
  const nonMatchingLabels = finalRouteMatchInfo?.matchDetails.filter((detail) => !detail.match) ?? [];

  return (
    <>
      <Button fill="outline" variant="secondary" size="sm" onClick={handleOpenDrawer}>
        <Trans i18nKey="alerting.instance-match.notification-policy">View journey</Trans>
      </Button>

      {isDrawerOpen && (
        <Drawer
          size="md"
          title={
            <>
              <Trans i18nKey="alerting.notification-route.notification-policy">Notification policy</Trans>
              {policyName && (
                <Text color="secondary" variant="bodySmall">
                  {' '}
                  ⋅ {policyName}
                </Text>
              )}
            </>
          }
          onClose={handleCloseDrawer}
        >
          <Stack direction="column" gap={2}>
            <Stack direction="column" gap={2} alignItems="center">
              <Stack direction="column" gap={0}>
                {journey.map((routeInfo, index) => (
                  <Fragment key={index}>
                    {index > 0 && (
                      <>
                        <ConnectionLine />
                        <MatchDetails
                          matchDetails={routeInfo.matchDetails}
                          labels={labels}
                          routeMatched={routeInfo.matched}
                        />
                        <ConnectionLine />
                      </>
                    )}
                    <JourneyPolicyCard
                      route={routeInfo.route}
                      isRoot={index === 0}
                      isFinalRoute={index === journey.length - 1}
                    />
                  </Fragment>
                ))}
              </Stack>

              {nonMatchingLabels.length > 0 && (
                <Stack direction="column">
                  <Text variant="body" color="secondary">
                    <Trans i18nKey="alerting.instance-match.non-matching-labels">Non-matching labels</Trans>
                  </Text>
                  <Stack direction="row" gap={0.5}>
                    {nonMatchingLabels.map((detail) => (
                      <Text key={detail.labelIndex} color="secondary" variant="bodySmall">
                        <Label label={labels[detail.labelIndex][0]} value={labels[detail.labelIndex][1]} />
                      </Text>
                    ))}
                  </Stack>
                </Stack>
              )}
            </Stack>

            <TextLink href={createRelativeUrl('/alerting/routes')} external inline={false}>
              <Trans i18nKey="alerting.notification-policy-drawer.view-notification-policy-tree">
                View notification policy tree
              </Trans>
            </TextLink>
          </Stack>
        </Drawer>
      )}
    </>
  );
}
