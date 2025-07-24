import { css } from '@emotion/css';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';

import { CatalogPlugin } from '../../types';

type Props = {
  plugin: CatalogPlugin;
};

export function PluginUpdateAvailableBadge({ plugin }: Props): React.ReactElement | null {
  const styles = useStyles2(getStyles);
  return (
    <p className={styles.hasUpdate}>
      <Trans i18nKey="plugins.plugin-update-available-badge.update-available">Update available!</Trans>
    </p>
  );
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
