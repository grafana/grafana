import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Alert, useStyles2 } from '@grafana/ui';

export const MarketplacePluginBanner = () => {
  const styles = useStyles2(getStyles);

  return (
    <Alert severity={'info'} title="" className={styles.alert}>
      <Trans i18nKey="plugins.marketplace-plugin-banner.info">
        This is a paid marketplace plugin. Support is provided by a Marketplace plugin partner.
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
