import { css } from '@emotion/css';
import { uniqueId } from 'lodash';
import pluralize from 'pluralize';
import { useToggle } from 'react-use';

import { Route, RouteMatchResult } from '@grafana/alerting/unstable';
import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { LinkButton, Text, useStyles2 } from '@grafana/ui';
import { ObjectMatcher } from 'app/plugins/datasource/alertmanager/types';

import { Stack } from '../../../../../../plugins/datasource/parca/QueryEditor/Stack';
import { getAmMatcherFormatter } from '../../../utils/alertmanager';
import { createViewPolicyLink } from '../../../utils/misc';
import { AlertLabels } from '../../AlertLabels';
import { CollapseToggle } from '../../CollapseToggle';
import { MetaText } from '../../MetaText';
import { Spacer } from '../../Spacer';

import { NotificationPolicyMatchers } from './NotificationPolicyMatchers';

interface NotificationRouteHeaderProps {
  isRootRoute: boolean;
  matchers?: ObjectMatcher[];
  instancesCount?: number;
  alertManagerSourceName: string;
  expandRoute?: boolean;
  onExpandRouteClick?: (isCollapsed: boolean) => void;
}

export function NotificationRouteHeader({
  isRootRoute = false,
  matchers = [],
  instancesCount = 0,
  alertManagerSourceName,
  expandRoute = false,
  onExpandRouteClick,
}: NotificationRouteHeaderProps) {
  const styles = useStyles2(getStyles);

  // @TODO: re-use component ContactPointsHoverDetails from Policy once we have it for cloud AMs.

  return (
    <div className={styles.routeHeader}>
      <CollapseToggle
        isCollapsed={!expandRoute}
        onToggle={(isCollapsed) => onExpandRouteClick?.(!isCollapsed)}
        aria-label={t('alerting.notification-route-header.aria-label-expand-policy-route', 'Expand policy route')}
      />

      <Stack flexGrow={1} gap={1} alignItems="center">
        {/* TODO: fix keyboard a11y */}
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
        <div onClick={() => onExpandRouteClick?.(!expandRoute)} className={styles.expandable}>
          <Stack gap={1} direction="row" alignItems="center">
            <Trans i18nKey="alerting.notification-route-header.notification-policy">Notification policy</Trans>
            {isRootRoute ? (
              <Text variant="bodySmall" color="secondary">
                <Trans i18nKey="alerting.notification-policy-matchers.default-policy">Default policy</Trans>
              </Text>
            ) : (
              <NotificationPolicyMatchers
                matchers={matchers}
                matcherFormatter={getAmMatcherFormatter(alertManagerSourceName)}
              />
            )}
          </Stack>
        </div>
        <Text color="secondary" variant="bodySmall">
          ⋅
        </Text>
        <Stack gap={1} direction="row" alignItems="center" flexGrow={1}>
          <MetaText icon="layers-alt" data-testid="matching-instances">
            {instancesCount ?? '-'} {pluralize('instance', instancesCount)}
          </MetaText>

          <Spacer />

          <LinkButton
            href={createViewPolicyLink(matchers, alertManagerSourceName)}
            variant="secondary"
            fill="outline"
            size="sm"
            target="_blank"
          >
            <Trans i18nKey="alerting.notification-route-header.see-details">View policy</Trans>
          </LinkButton>
        </Stack>
      </Stack>
    </div>
  );
}

interface NotificationRouteProps {
  isRootRoute: boolean;
  matchers?: ObjectMatcher[];
  alertManagerSourceName: string;
  matchedInstances: Array<RouteMatchResult<Route>>;
}

export function NotificationRoute({
  alertManagerSourceName,
  matchedInstances,
  isRootRoute,
  matchers,
}: NotificationRouteProps) {
  const styles = useStyles2(getStyles);
  const [expandRoute, setExpandRoute] = useToggle(false);

  return (
    <div data-testid="matching-policy-route">
      <NotificationRouteHeader
        // every instance has the same route that matched so it's fine to grab the first one
        isRootRoute={isRootRoute}
        matchers={matchers}
        instancesCount={matchedInstances.length}
        alertManagerSourceName={alertManagerSourceName}
        expandRoute={expandRoute}
        onExpandRouteClick={setExpandRoute}
      />
      {expandRoute && (
        <div className={styles.routeInstances} data-testid="route-matching-instance">
          <Stack gap={1} direction="column">
            {matchedInstances.map(({ labels, matchDetails }) => {
              const matchingLabels = matchDetails.filter((mr) => mr.match);
              const nonMatchingLabels = matchDetails.filter((mr) => !mr.match);

              return (
                <div className={styles.tagListCard} key={uniqueId()}>
                  {labels.length > 0 ? (
                    <>
                      {matchingLabels.length > 0 ? (
                        <AlertLabels
                          size="sm"
                          labels={Object.fromEntries(matchingLabels.map((mr) => labels[mr.labelIndex]))}
                        />
                      ) : (
                        <Text italic>
                          <Trans i18nKey="alerting.notification-route.no-matching-labels">No matching labels</Trans>
                        </Text>
                      )}
                      <div className={styles.labelSeparator} />
                      <AlertLabels
                        size="sm"
                        labels={Object.fromEntries(nonMatchingLabels.map((mr) => labels[mr.labelIndex]))}
                      />
                    </>
                  ) : (
                    <Text color="secondary">
                      <Trans i18nKey="alerting.notification-route.no-labels">No labels</Trans>
                    </Text>
                  )}
                </div>
              );
            })}
          </Stack>
        </div>
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  expandable: css({
    cursor: 'pointer',
  }),
  routeHeader: css({
    display: 'flex',
    flexDirection: 'row',
    gap: theme.spacing(1),
    alignItems: 'center',
    padding: theme.spacing(0.5),
    '&:hover': {
      backgroundColor: theme.components.table.rowHoverBackground,
    },
  }),
  labelSeparator: css({
    width: '1px',
    backgroundColor: theme.colors.border.weak,
  }),
  tagListCard: css({
    display: 'flex',
    flexDirection: 'row',
    gap: theme.spacing(2),

    position: 'relative',
    background: theme.colors.background.secondary,
    padding: theme.spacing(1),

    borderRadius: theme.shape.borderRadius(2),
    border: `solid 1px ${theme.colors.border.weak}`,
  }),
  routeInstances: css({
    padding: theme.spacing(1, 0, 1, 2),
  }),
});
