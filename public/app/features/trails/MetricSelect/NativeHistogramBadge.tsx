import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneObjectBase } from '@grafana/scenes';
import { Badge, useStyles2 } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

export class NativeHistogramBadge extends SceneObjectBase {
  public static Component = () => {
    const styles = useStyles2(getStyles);
    return (
      <Badge
        className={styles.badge}
        color="blue"
        text={<Trans i18nKey="trails.metric-select.native-histogram">Native Histogram</Trans>}
      />
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    badge: css({
      borderRadius: theme.shape.radius.pill,
      border: `1px solid ${theme.colors.info.text}`,
      background: theme.colors.info.transparent,
      cursor: 'auto',
      width: '112px',
      padding: '0rem 0.25rem 0 0.35rem',
    }),
  };
}
