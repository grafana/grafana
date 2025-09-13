import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { TextLink, useStyles2 } from '@grafana/ui';

export function Footnote() {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.footNote}>
      <Trans i18nKey="connections.feature-highlight-page.foot-note">
        After creating an account, you can have Grafana{' '}
        <TextLink href="https://grafana.com/products/bring-your-own-cloud-byoc/">
          migrate this instance to Grafana Cloud
        </TextLink>{' '}
        with minimal effort.
      </Trans>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  footNote: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
});
