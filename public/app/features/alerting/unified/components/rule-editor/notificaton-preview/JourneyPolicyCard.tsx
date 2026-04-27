import { css } from '@emotion/css';

import { type RouteWithID } from '@grafana/alerting';
import { type GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Icon, Stack, Text, Tooltip, useStyles2 } from '@grafana/ui';
import { type ObjectMatcher } from 'app/plugins/datasource/alertmanager/types';

import { labelMatcherToObjectMatcher } from '../../../utils/routeAdapter';
import { Matchers } from '../../notification-policies/Matchers';
import { DefaultPolicyIndicator } from '../../notification-policies/Policy';
import { NAMED_ROOT_LABEL_NAME } from '../../notification-policies/useNotificationPolicyRoute';

interface JourneyPolicyCardProps {
  route: RouteWithID;
  isRoot?: boolean;
  isFinalRoute?: boolean;
  policyName?: string;
}

export function JourneyPolicyCard({ route, isRoot = false, isFinalRoute = false, policyName }: JourneyPolicyCardProps) {
  const styles = useStyles2(getStyles);

  // Convert route matchers to ObjectMatcher format, filtering the internal routing label from the root card.
  const matchers: ObjectMatcher[] = (route.matchers?.map(labelMatcherToObjectMatcher) ?? []).filter(
    (m) => !isRoot || m[0] !== NAMED_ROOT_LABEL_NAME
  );

  const hasMatchers = matchers.length > 0;
  const continueMatching = route.continue ?? false;

  return (
    <article className={styles.policyWrapper(isFinalRoute)} aria-current={isFinalRoute ? 'true' : 'false'}>
      {continueMatching && <ContinueMatchingIndicator />}
      <Stack direction="column" gap={0.5}>
        {/* root route indicator — render the tree name for named policy trees, fall back to
            DefaultPolicyIndicator when policyName is undefined (the default tree). */}
        {isRoot &&
          (policyName ? (
            <Text element="h2" variant="body" weight="medium">
              {policyName}
            </Text>
          ) : (
            <DefaultPolicyIndicator />
          ))}

        {/* Matchers */}
        {hasMatchers ? (
          <Matchers matchers={matchers} formatter={undefined} />
        ) : (
          <Text variant="bodySmall" color="secondary">
            <Trans i18nKey="alerting.policies.no-matchers">No matchers</Trans>
          </Text>
        )}

        {/* Route metadata */}
        <Stack direction="row" alignItems="center" gap={1}>
          {route.receiver && (
            <Text variant="bodySmall" color="secondary">
              <Icon name="at" size="xs" /> {route.receiver}
            </Text>
          )}
          {route.group_by && route.group_by.length > 0 && (
            <Text variant="bodySmall" color="secondary">
              <Icon name="layer-group" size="xs" /> {route.group_by.join(', ')}
            </Text>
          )}
        </Stack>
      </Stack>
    </article>
  );
}

const ContinueMatchingIndicator = () => {
  const styles = useStyles2(getStyles);

  return (
    <Tooltip
      placement="top"
      content={
        <Trans i18nKey="alerting.continue-matching-indicator.content-route-continue-matching-other-policies">
          This route will continue matching other policies
        </Trans>
      }
    >
      <div className={styles.gutterIcon} data-testid="continue-matching">
        <Icon name="arrow-down" />
      </div>
    </Tooltip>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  policyWrapper: (hasFocus = false) =>
    css({
      position: 'relative',
      background: theme.colors.background.secondary,
      borderRadius: theme.shape.radius.default,
      border: `solid 1px ${theme.colors.border.weak}`,
      ...(hasFocus && {
        borderColor: theme.colors.primary.border,
        background: theme.colors.primary.transparent,
      }),
      padding: theme.spacing(1),
    }),
  gutterIcon: css({
    position: 'absolute',
    left: `-${theme.spacing(3.5)}`,
    top: theme.spacing(2.25),

    color: theme.colors.text.secondary,
    background: theme.colors.background.primary,

    width: '20px',
    height: '20px',

    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',

    border: `solid 1px ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
  }),
});
