import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, PluginExtensionPoints } from '@grafana/data';
import { getPluginComponentExtensions } from '@grafana/runtime';
import { useStyles2, Stack, Box } from '@grafana/ui';

export function PluginIntegrations() {
  const styles = useStyles2(getPluginIntegrationsStyles);

  const { extensions } = getPluginComponentExtensions({
    extensionPointId: PluginExtensionPoints.AlertingHomePage,
    limitPerPlugin: 1,
  });

  return (
    <div className={styles.container}>
      {/* <h4>Enhance Alerting experience with our tailored apps</h4> */}
      <Stack gap={1} wrap="wrap" direction="column">
        {extensions.map((extension) => (
          <Box key={extension.id} borderColor="weak" borderRadius="default" padding={2} flex={1}>
            <extension.component />
          </Box>
        ))}
      </Stack>
    </div>
  );
}

const getPluginIntegrationsStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  }),
});
