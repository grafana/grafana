import { css } from '@emotion/css';

import { FeatureState, GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Card, FeatureBadge, TextLink, useStyles2 } from '@grafana/ui';

export function SqlExpressionsBanner() {
  const styles = useStyles2(getStyles);

  return (
    <Card noMargin>
      <Card.Heading>
        <div className={styles.sqlExpressionsHeading}>
          <Trans i18nKey="dashboard.transformation-picker-ng.sql-expressions-message">SQL Expressions</Trans>
          <FeatureBadge featureState={FeatureState.new} />
        </div>
      </Card.Heading>
      <Card.Description className={styles.sqlExpressionsDescription}>
        <Trans i18nKey="dashboard.transformation-picker-ng.sql-expressions-message-description">
          A new way to manipulate and transform the results of data source queries using MySQL-like syntax.
        </Trans>
        <TextLink
          href="https://grafana.com/docs/grafana/latest/panels-visualizations/query-transform-data/sql-expressions/"
          external
        >
          <Trans i18nKey="dashboard.transformation-picker-ng.sql-expressions-message-link">Learn more</Trans>
        </TextLink>
      </Card.Description>
    </Card>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    sqlExpressionsHeading: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
    }),
    sqlExpressionsDescription: css({
      display: 'flex',
      gap: theme.spacing(1),
    }),
    sqlExpressionsLink: css({
      minWidth: theme.spacing(10),
    }),
  };
}
