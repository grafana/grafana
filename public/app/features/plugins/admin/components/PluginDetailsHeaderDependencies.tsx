import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, Icon } from '@grafana/ui';
import { CatalogPlugin } from '../types';

type Props = {
  plugin: CatalogPlugin;
  className?: string;
};

const PluginIconClassName: Record<string, string> = {
  datasource: 'gicon gicon-datasources',
  panel: 'icon-gf icon-gf-panel',
  app: 'icon-gf icon-gf-apps',
  page: 'icon-gf icon-gf-endpoint-tiny',
  dashboard: 'gicon gicon-dashboard',
  default: 'icon-gf icon-gf-apps',
};

export function PluginDetailsHeaderDependencies({ plugin, className }: Props): React.ReactElement | null {
  const styles = useStyles2(getStyles);
  const pluginDependencies = plugin.details?.pluginDependencies;
  const grafanaDependency = plugin.details?.grafanaDependency;
  const hasNoDependencyInfo = !grafanaDependency && (!pluginDependencies || !pluginDependencies.length);

  if (hasNoDependencyInfo) {
    return null;
  }

  return (
    <div className={className}>
      <div className={styles.textBold}>Dependencies:</div>

      {/* Grafana dependency */}
      {Boolean(grafanaDependency) && (
        <div>
          <Icon name="grafana" />
          Grafana {grafanaDependency}
        </div>
      )}

      {/* Plugin dependencies */}
      {pluginDependencies && pluginDependencies.length > 0 && (
        <div>
          {pluginDependencies.map((p) => {
            return (
              <span key={p.name}>
                <i className={PluginIconClassName[p.type] || PluginIconClassName.default} />
                {p.name} {p.version}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    textBold: css`
      font-weight: ${theme.typography.fontWeightBold};
    `,
  };
};
