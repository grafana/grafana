import { Fragment, useMemo } from 'react';

import { AlertLabel, type RouteMatchResult, type RouteWithID } from '@grafana/alerting';
import { Trans } from '@grafana/i18n';
import { Divider, Drawer, Text, TextLink } from '@grafana/ui';

import { Stack } from '../../../../../../plugins/datasource/parca/QueryEditor/Stack';
import { ROOT_ROUTE_NAME } from '../../../utils/k8s/constants';
import { createRelativeUrl } from '../../../utils/url';

import { ConnectionLine } from './ConnectionLine';
import { JourneyPolicyCard } from './JourneyPolicyCard';
import { MatchDetails } from './MatchDetails';

type JourneyEntry = {
  journey: RouteMatchResult<RouteWithID>['matchingJourney'];
  policyName?: string;
};

type NotificationPolicySidebarProps = {
  journeys: JourneyEntry[];
  labels: Array<[string, string]>;
  onClose: () => void;
};

export function NotificationPolicySidebar({ journeys, labels, onClose }: NotificationPolicySidebarProps) {
  // The default tree's metadata.name is ROOT_ROUTE_NAME ("user-defined"); treat that as no name
  // so downstream rendering shows "Default policy" rather than the internal identifier.
  const normalizedJourneys = useMemo(
    () =>
      journeys.map(({ journey, policyName }) => ({
        journey,
        policyName: policyName !== ROOT_ROUTE_NAME ? policyName : undefined,
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
      <Stack direction="column" gap={2}>
        {normalizedJourneys.map(({ journey, policyName }, journeyIndex) => {
          const finalRouteMatchInfo = journey.at(-1);
          // Labels the final policy evaluated but did not match on.
          const nonMatchingLabels = finalRouteMatchInfo?.matchDetails.filter((detail) => !detail.match) ?? [];

          return (
            <Fragment key={journeyIndex}>
              {journeyIndex > 0 && <Divider />}
              <Stack direction="column" gap={2} alignItems="center">
                <Stack direction="column" gap={0}>
                  {journey.map((routeInfo, index) => (
                    <Fragment key={index}>
                      {/* MatchDetails explains why the parent routed to this child — skipped for the root node. */}
                      {index > 0 && (
                        <>
                          <ConnectionLine />
                          <MatchDetails matchDetails={routeInfo.matchDetails} labels={labels} />
                          <ConnectionLine />
                        </>
                      )}
                      <JourneyPolicyCard
                        route={routeInfo.route}
                        isRoot={index === 0}
                        isFinalRoute={index === journey.length - 1}
                        policyName={index === 0 ? policyName : undefined}
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
                          <AlertLabel labelKey={labels[detail.labelIndex][0]} value={labels[detail.labelIndex][1]} />
                        </Text>
                      ))}
                    </Stack>
                  </Stack>
                )}
              </Stack>
            </Fragment>
          );
        })}

        <TextLink href={createRelativeUrl('/alerting/routes')} external inline={false}>
          <Trans i18nKey="alerting.notification-policy-drawer.view-notification-policy-tree">
            View notification policy tree
          </Trans>
        </TextLink>
      </Stack>
    </Drawer>
  );
}
