import { css } from '@emotion/css';
import { useCallback } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { config, getBackendSrv } from '@grafana/runtime';
import { Button, Stack, Text, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';

export function UserSimulationBanner() {
  const styles = useStyles2(getStyles);
  const sim = contextSrv.user.userSimulation;

  const onExit = useCallback(async () => {
    try {
      await getBackendSrv().delete('/api/admin/user-simulation');
      window.location.assign(window.location.origin + (config.appSubUrl || '') + '/');
    } catch (e) {
      console.error(e);
    }
  }, []);

  if (!sim) {
    return null;
  }

  return (
    <div className={styles.wrap} data-testid="user-simulation-banner">
      <Stack justifyContent="center" alignItems="center" gap={2}>
        <Text variant="bodySmall" weight="bold">
          <Trans i18nKey="user-simulation.banner" values={{ actor: sim.actorLogin, target: sim.targetLogin }}>
            Viewing as {{ target }} (signed in as Grafana admin: {{ actor }})
          </Trans>
        </Text>
        <Button size="sm" variant="secondary" onClick={onExit}>
          <Trans i18nKey="user-simulation.exit">Exit simulation</Trans>
        </Button>
      </Stack>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    wrap: css({
      label: 'user-simulation-banner',
      width: '100%',
      padding: theme.spacing(0.5, 1),
      background: theme.colors.warning.main,
      color: theme.colors.warning.contrastText,
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    }),
  };
}
