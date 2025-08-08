import { css } from '@emotion/css';

import { Route, RouteMatchResult } from '@grafana/alerting/unstable';
import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Text, useStyles2 } from '@grafana/ui';

import { Stack } from '../../../../../../plugins/datasource/parca/QueryEditor/Stack';
import { AlertLabels } from '../../AlertLabels';

type InstanceMatchProps = {
  matchedInstance: RouteMatchResult<Route>;
};

export function InstanceMatch({ matchedInstance }: InstanceMatchProps) {
  const styles = useStyles2(getStyles);

  const labels = matchedInstance.labels;
  const matchingLabels = matchedInstance.matchDetails.filter((mr) => mr.match);
  const nonMatchingLabels = matchedInstance.matchDetails.filter((mr) => !mr.match);

  return (
    <div className={styles.instanceListItem}>
      <Stack direction="row" gap={2} alignItems="center">
        {labels.length > 0 ? (
          <>
            {matchingLabels.length > 0 ? (
              <AlertLabels size="sm" labels={Object.fromEntries(matchingLabels.map((mr) => labels[mr.labelIndex]))} />
            ) : (
              <Text italic>
                <Trans i18nKey="alerting.notification-route.no-matching-labels">No matching labels</Trans>
              </Text>
            )}
            <div className={styles.labelSeparator} />
            <AlertLabels size="sm" labels={Object.fromEntries(nonMatchingLabels.map((mr) => labels[mr.labelIndex]))} />
          </>
        ) : (
          <Text color="secondary">
            <Trans i18nKey="alerting.notification-route.no-labels">No labels</Trans>
          </Text>
        )}
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
  labelSeparator: css({
    width: '1px',
    backgroundColor: theme.colors.border.weak,
  }),
});
