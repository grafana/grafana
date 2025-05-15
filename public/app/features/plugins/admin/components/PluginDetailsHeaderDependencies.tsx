import { css } from '@emotion/css';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { useStyles2, Icon, Stack } from '@grafana/ui';

import { CatalogPlugin, PluginIconName } from '../types';

type Props = {
  plugin: CatalogPlugin;
  grafanaDependency?: string;
  className?: string;
};

export function PluginDetailsHeaderDependencies({ plugin, grafanaDependency }: Props): React.ReactElement | null {
  const styles = useStyles2(getStyles);
  const pluginDependencies = plugin.details?.pluginDependencies;
  const hasNoDependencyInfo = !grafanaDependency && (!pluginDependencies || !pluginDependencies.length);

  if (hasNoDependencyInfo) {
    return null;
  }

  return (
    <Stack gap={1}>
      {/* Grafana dependency */}
      {Boolean(grafanaDependency) && (
        <div className={styles.depBadge}>
          <Icon name="grafana" className={styles.icon} />
          <Trans i18nKey="plugins.plugin-details-header-dependencies.grafana-dependency">
            Grafana {{ grafanaDependency }}
          </Trans>
        </div>
      )}

      {/* Plugin dependencies */}
      {pluginDependencies && pluginDependencies.length > 0 && (
        <div>
          {pluginDependencies.map((p) => {
            return (
              <span className={styles.depBadge} key={p.name}>
                <Icon name={PluginIconName[p.type]} className={styles.icon} />
                {p.name} {p.version}
              </span>
            );
          })}
        </div>
      )}
    </Stack>
  );
}

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    dependencyTitle: css({
      marginRight: theme.spacing(0.5),

      '&::after': {
        content: "''",
        padding: 0,
      },
    }),
    depBadge: css({
      display: 'flex',
      alignItems: 'flex-start',
    }),
    icon: css({
      color: theme.colors.text.secondary,
      marginRight: theme.spacing(0.5),
    }),
  };
};
