import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Alert, TextLink, useStyles2 } from '@grafana/ui';

export const MarketplacePluginBanner = () => {
  const styles = useStyles2(getStyles);

  return (
    <Alert severity={'info'} title="" className={styles.alert}>
      <Trans i18nKey="plugins.marketplace-plugin-banner.info">
        This is a marketplace plugin requiring a subscription. Support is provided by a marketplace{' '}
        <TextLink href="https://grafana.com/legal/plugins/" external>
          plugin partner
        </TextLink>
        .
      </Trans>
    </Alert>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    alert: css({
      marginTop: `${theme.spacing(2)}`,
    }),
  };
};
