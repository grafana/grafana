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
        <div className="markdown-html">
          <p>The selected panel plugin is using deprecated plugin APIs.</p>
          <ul>
            <li>
              <a
                href="https://grafana.com/docs/grafana/latest/developers/angular_deprecation/"
                className="external-link"
                target="_blank"
                rel="noreferrer"
              >
                Read more on Angular deprecation
              </a>
            </li>
            <li>
              <a href={`plugins/${encodeURIComponent(plugin.meta.id)}`} className="external-link">
                View plugin details
              </a>
            </li>
          </ul>
        </div>
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
