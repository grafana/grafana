import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { useTheme2 } from '@grafana/ui';

function getStyles(theme: GrafanaTheme2) {
  return {
    empty: css({
      marginBottom: theme.spacing(2),
      marginLeft: theme.spacing(1.75),
      fontSize: theme.typography.fontSize,
    }),
  };
}

export function LogsTableEmptyFields() {
  const theme = useTheme2();
  const styles = getStyles(theme);
  return (
    <div className={styles.empty}>
      <Trans i18nKey="explore.logs-table-empty-fields.no-fields">No fields</Trans>
    </div>
  );
}
