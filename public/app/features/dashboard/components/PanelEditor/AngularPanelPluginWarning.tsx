import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, PanelPlugin } from '@grafana/data';
import { Alert, useStyles2 } from '@grafana/ui';

export interface Props {
  plugin: PanelPlugin;
}

export function AngularPanelPluginWarning({ plugin }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.wrapper}>
      <Alert title="Angular panel plugin" severity="warning">
        The selected visualization plugin is using deprecated plugin APIs and will stop working in Grafana 11.
      </Alert>
    </div>
  );
}

export function getStyles(theme: GrafanaTheme2) {
  return {
    wrapper: css({
      padding: theme.spacing(1),
    }),
  };
}
