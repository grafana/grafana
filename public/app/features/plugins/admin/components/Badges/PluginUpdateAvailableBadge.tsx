import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Tooltip, useStyles2 } from '@grafana/ui';
import { CatalogPlugin } from '../../types';

type Props = {
  plugin: CatalogPlugin;
};

export function PluginUpdateAvailableBadge({ plugin }: Props): React.ReactElement | null {
  const styles = useStyles2(getStyles);

  if (plugin.hasUpdate && !plugin.isCore) {
    return (
      <Tooltip content={plugin.version}>
        <p className={styles.hasUpdate}>Update available!</p>
      </Tooltip>
    );
  }

  return null;
}

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    hasUpdate: css`
      color: ${theme.colors.text.secondary};
      font-size: ${theme.typography.bodySmall.fontSize};
      margin-bottom: 0;
    `,
  };
};
