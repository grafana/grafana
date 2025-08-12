import { css } from '@emotion/css';

import { RouteMatchResult, RouteWithID } from '@grafana/alerting/unstable';
import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Text, useStyles2 } from '@grafana/ui';

import { Stack } from '../../../../../../plugins/datasource/parca/QueryEditor/Stack';
import { AlertLabels } from '../../AlertLabels';
import { Spacer } from '../../Spacer';

import { NotificationPolicyDrawer } from './NotificationPolicyDrawer';

type TreeMeta = {
  name?: string;
};

type InstanceMatchProps = {
  matchedInstance: RouteMatchResult<RouteWithID>;
  policyTreeSpec: RouteWithID;
  policyTreeMetadata: TreeMeta;
};

export function InstanceMatch({ matchedInstance, policyTreeSpec, policyTreeMetadata }: InstanceMatchProps) {
  const styles = useStyles2(getStyles);

  const { labels, matchingJourney, route } = matchedInstance;

  // Get all match details from the final matched route in the journey
  const finalRouteMatchInfo = matchingJourney[matchingJourney.length - 1];
  const matchingLabels = finalRouteMatchInfo?.matchDetails.filter((detail) => detail.match) ?? [];
  const nonMatchingLabels = finalRouteMatchInfo?.matchDetails.filter((detail) => !detail.match) ?? [];

  const matchedRootRoute = route.id === policyTreeSpec.id;

  return (
    <div className={styles.instanceListItem}>
      <Stack direction="row" gap={2} alignItems="center">
        {labels.length > 0 ? (
          <>
            <AlertLabels
              size="sm"
              labels={Object.fromEntries(matchingLabels.map((detail) => labels[detail.labelIndex]))}
            />
            <AlertLabels
              size="sm"
              labels={Object.fromEntries(nonMatchingLabels.map((detail) => labels[detail.labelIndex]))}
            />
          </>
        ) : (
          <Text color="secondary">
            <Trans i18nKey="alerting.notification-route.no-labels">No labels</Trans>
          </Text>
        )}
        <Spacer />
        <NotificationPolicyDrawer
          labels={labels}
          policyName={policyTreeMetadata.name}
          matchedRootRoute={matchedRootRoute}
          journey={matchingJourney}
        />
      </Stack>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  instanceListItem: css({
    padding: theme.spacing(1, 2),

    '&:hover': {
      backgroundColor: theme.components.table.rowHoverBackground,
    },
  }),
});
