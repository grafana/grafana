import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { useStyles2, Icon } from '@grafana/ui';

import { Version, CatalogPlugin, PluginIconName } from '../types';

type Props = {
  plugin: CatalogPlugin;
  latestCompatibleVersion?: Version;
  className?: string;
};

export function PluginDetailsHeaderDependencies({
  plugin,
  latestCompatibleVersion,
  className,
}: Props): React.ReactElement | null {
  const styles = useStyles2(getStyles);
  const pluginDependencies = plugin.details?.pluginDependencies;
  const grafanaDependency = plugin.isInstalled
    ? plugin.details?.grafanaDependency
    : latestCompatibleVersion?.grafanaDependency || plugin.details?.grafanaDependency;
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
          Grafana {grafanaDependency}
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
    dependencyTitle: css`
      margin-right: ${theme.spacing(0.5)};

      &::after {
        content: '';
        padding: 0;
      }
    `,
    depBadge: css({
      display: 'flex',
      alignItems: 'flex-start',
    }),
    icon: css`
      color: ${theme.colors.text.secondary};
      margin-right: ${theme.spacing(0.5)};
    `,
  };
};
