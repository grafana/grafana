import { css } from '@emotion/css';
import { Fragment } from 'react';

import { Route, RouteMatchResult } from '@grafana/alerting/unstable';
import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Button, Grid, Text, TextLink, useStyles2 } from '@grafana/ui';
import { MatcherOperator, ObjectMatcher, RouteWithID } from 'app/plugins/datasource/alertmanager/types';

import { Stack } from '../../../../../../plugins/datasource/parca/QueryEditor/Stack';
import { AlertLabels } from '../../AlertLabels';
import { PopupCard } from '../../HoverCard';
import { Label } from '../../Label';
import { Spacer } from '../../Spacer';
import { MatcherBadge, Matchers } from '../../notification-policies/Matchers';

type TreeMeta = {
  name?: string;
};

type InstanceMatchProps = {
  matchedInstance: RouteMatchResult<Route>;
  policyTreeSpec: RouteWithID;
  policyTreeMetadata: TreeMeta;
};

export function InstanceMatch({ matchedInstance, policyTreeSpec, policyTreeMetadata }: InstanceMatchProps) {
  const styles = useStyles2(getStyles);

  const { labels, matchDetails, route } = matchedInstance;

  const matchingLabels = matchDetails.filter((mr) => mr.match);
  const nonMatchingLabels = matchDetails.filter((mr) => !mr.match);

  const matchersArray: ObjectMatcher[] =
    matchedInstance.route.matchers?.map((matcher) => [matcher.label, matcher.type as MatcherOperator, matcher.value]) ??
    [];
  const matchedRootRoute = route.id === policyTreeSpec.id;

  return (
    <div className={styles.instanceListItem}>
      <Stack direction="row" gap={2} alignItems="center">
        {labels.length > 0 ? (
          <>
            <AlertLabels size="sm" labels={Object.fromEntries(matchingLabels.map((mr) => labels[mr.labelIndex]))} />
            <AlertLabels size="sm" labels={Object.fromEntries(nonMatchingLabels.map((mr) => labels[mr.labelIndex]))} />
          </>
        ) : (
          <Text color="secondary">
            <Trans i18nKey="alerting.notification-route.no-labels">No labels</Trans>
          </Text>
        )}
        <Spacer />
        <PopupCard
          header={
            <>
              <Trans i18nKey="alerting.notification-route.notification-policy">Notification policy</Trans>
              {policyTreeMetadata.name && (
                <>
                  {' '}
                  ⋅{' '}
                  <Text color="secondary" variant="bodySmall">
                    {policyTreeMetadata.name}
                  </Text>
                </>
              )}
            </>
          }
          content={
            <Stack direction="column" gap={0.5}>
              {matchedRootRoute && (
                <Text color="secondary" variant="bodySmall">
                  <Trans i18nKey="alerting.instance-match.default-policy">Default policy</Trans>
                </Text>
              )}
              {<Matchers formatter={undefined} matchers={matchersArray} />}
              <Text variant="body">
                <Trans i18nKey="alerting.instance-match.matcher-diagnostics">Matcher diagnostics</Trans>
              </Text>
              <Grid columns={2} columnGap={1} rowGap={0.5}>
                {matchingLabels.map(({ labelIndex, matcher }) => (
                  <Fragment key={labelIndex}>
                    <Text color="secondary" variant="bodySmall">
                      <Label label={labels[labelIndex][0]} value={labels[labelIndex][1]} /> matched{' '}
                    </Text>
                    <MatcherBadge matcher={[matcher.label, matcher.type as MatcherOperator, matcher.value]} />
                  </Fragment>
                ))}
              </Grid>
              <Grid columns={2} columnGap={1} rowGap={0.5}>
                {nonMatchingLabels.map(({ labelIndex }) => (
                  <Fragment key={labelIndex}>
                    <Text color="secondary" variant="bodySmall">
                      <Label label={labels[labelIndex][0]} value={labels[labelIndex][1]} />
                    </Text>
                    <Text color="secondary">
                      <Trans i18nKey="alerting.instance-match.not-matched">not matched</Trans>
                    </Text>
                  </Fragment>
                ))}
              </Grid>
              <TextLink href={'#'} inline={false} external>
                <Trans i18nKey="alerting.notification-route.view-notification-policy">View notification policy</Trans>
              </TextLink>
            </Stack>
          }
        >
          <Button fill="outline" icon="info" variant="secondary" size="sm">
            <Trans i18nKey="alerting.instance-match.notification-policy">Notification policy</Trans>
          </Button>
        </PopupCard>
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
