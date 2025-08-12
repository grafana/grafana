import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Text, useStyles2 } from '@grafana/ui';
import { MatcherOperator } from 'app/plugins/datasource/alertmanager/types';

import { Label } from '../../Label';
import { MatcherBadge } from '../../notification-policies/Matchers';

type LabelMatchDetails = {
  labelIndex: number;
  match: boolean;
  matcher: {
    label: string;
    type: string;
    value: string;
  } | null;
};

interface MatchDetailsProps {
  matchDetails: LabelMatchDetails[];
  labels: Array<[string, string]>;
  routeMatched: boolean;
}

export function MatchDetails({ matchDetails, labels, routeMatched }: MatchDetailsProps) {
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
          <div key={detail.labelIndex} className={styles.matchPill}>
            <Label label={labels[detail.labelIndex][0]} value={labels[detail.labelIndex][1]} />
            <Text variant="bodySmall" color="secondary">
              <Trans i18nKey="alerting.match-details.matched">matched</Trans>
            </Text>
            {detail.matcher && (
              <MatcherBadge
                matcher={[detail.matcher.label, detail.matcher.type as MatcherOperator, detail.matcher.value]}
              />
            )}
          </div>
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
  matchPill: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  }),
});
