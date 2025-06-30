import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Text, useStyles2 } from '@grafana/ui';

// @TODO I don't like applying the margins to this component here, ideally the parent component should be layouting this.
export const NoRulesFound = () => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.noRules}>
      <Text color="secondary">
        <Trans i18nKey="alerting.rule-list.empty-data-source">No rules found</Trans>
      </Text>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  noRules: css({
    margin: theme.spacing(1.5, 0, 0.5, 4),
  }),
});
