import { css } from '@emotion/css';

import { AlertLabel, LabelMatchDetails } from '@grafana/alerting/unstable';
import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Box, Text, useStyles2 } from '@grafana/ui';

import { labelMatcherToObjectMatcher } from '../../../utils/routeAdapter';
import { MatcherBadge } from '../../notification-policies/Matchers';

interface MatchDetailsProps {
  matchDetails: LabelMatchDetails[];
  labels: Array<[string, string]>;
}

export function MatchDetails({ matchDetails, labels }: MatchDetailsProps) {
  const styles = useStyles2(getStyles);
  const matchingLabels = matchDetails.filter((detail) => detail.match);

  const noMatchingLabels = matchingLabels.length === 0;

  return (
    <div className={styles.container}>
      {noMatchingLabels ? (
        <Text variant="bodySmall" color="secondary">
          <Trans i18nKey="alerting.match-details.no-matchers-matched">Policy matches all labels</Trans>
        </Text>
      ) : (
        matchingLabels.map((detail) => (
          <Box key={detail.labelIndex} display="flex" alignItems="center" gap={1}>
            <AlertLabel labelKey={labels[detail.labelIndex][0]} value={labels[detail.labelIndex][1]} />
            <Text variant="bodySmall" color="secondary">
              <Trans i18nKey="alerting.match-details.matched">matched</Trans>
            </Text>
            {detail.matcher && <MatcherBadge matcher={labelMatcherToObjectMatcher(detail.matcher)} />}
          </Box>
        ))
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    padding: `${theme.spacing(1)} ${theme.spacing(2)}`,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    background: theme.colors.background.secondary,
    borderRadius: theme.shape.radius.pill,
    border: `solid 1px ${theme.colors.border.weak}`,

    width: 'fit-content',
    alignSelf: 'center',
  }),
});
