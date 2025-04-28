import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack, Text, useStyles2 } from '@grafana/ui';

import { Trans } from '../../../../core/internationalization';
import { useAlertingHomePageExtensions } from '../plugins/useAlertingHomePageExtensions';

export function PluginIntegrations() {
  const styles = useStyles2(getStyles);

  const { components } = useAlertingHomePageExtensions();

  if (components.length === 0) {
    return null;
  }

  return (
    <Stack direction="column" gap={2}>
      <Text element="h3" variant="h4">
        <Trans i18nKey="alerting.plugin-integrations.tailored-apps">
          Speed up your alerts creation now by using one of our tailored apps
        </Trans>
      </Text>
      <Stack gap={2} wrap="wrap" direction="row">
        {components.map((Component, i) => (
          <div key={i} className={styles.box}>
            <Component />
          </div>
        ))}
      </Stack>
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  box: css({
    padding: theme.spacing(2),
    flex: 1,
    backgroundColor: theme.colors.background.secondary,
    maxWidth: '460px',
  }),
});
