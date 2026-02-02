import { css } from '@emotion/css';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
// BMC code - comment next line
// import { useStyles2 } from '@grafana/ui';

import { CatalogPlugin } from '../../types';

type Props = {
  plugin: CatalogPlugin;
};

export function PluginUpdateAvailableBadge({ plugin }: Props): React.ReactElement | null {
  // BMC Code : Comment below block
  // const styles = useStyles2(getStyles);
  // return <p className={styles.hasUpdate}>Update available!</p>;
  return null;
  // BMC Code: End
}

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    hasUpdate: css({
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      marginBottom: 0,
    }),
  };
};
