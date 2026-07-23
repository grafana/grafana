import { css } from '@emotion/css';

import { type GrafanaTheme2, type PanelProps } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';

export function TextNGPanel({ data }: PanelProps) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container} data-testid="TextNGPanel">
      <Trans i18nKey="textng.placeholder">New text panel</Trans> ({data.series.length})
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    height: '100%',
    padding: theme.spacing(1),
  }),
});
