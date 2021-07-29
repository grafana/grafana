import React from 'react';
import { css } from '@emotion/css';
import { Badge, HorizontalGroup, LinkButton, PluginSignatureBadge, useStyles2 } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { CatalogPlugin } from '../types';

type PluginBadgeType = {
  plugin: CatalogPlugin;
};

export function PluginBadges({ plugin }: PluginBadgeType) {
  if (plugin.isEnterprise) {
    return <EnterpriseBadge />;
  }
  return (
    <HorizontalGroup>
      <PluginSignatureBadge status={plugin.signature} />
      {plugin.isInstalled && <InstalledBadge />}
    </HorizontalGroup>
  );
}

function EnterpriseBadge() {
  const styles = useStyles2(getEnterpriseBadgeColors);
  if (config.licenseInfo?.hasValidLicense) {
    return <Badge text="Enterprise" color="blue" />;
  }

  return (
    <HorizontalGroup>
      <Badge icon="lock" text="Enterprise" color="blue" className={styles.noLicense} />
      <LinkButton size="sm" fill="text" icon="external-link-alt" href="https://grafana.com/products/enterprise/">
        Learn more
      </LinkButton>
    </HorizontalGroup>
  );
}

function InstalledBadge() {
  const styles = useStyles2(getInstalledBadgeColors);
  return <Badge text="Installed" color="orange" className={styles.installed} />;
}

const getEnterpriseBadgeColors = (theme: GrafanaTheme2) => ({
  noLicense: css`
    background: ${theme.colors.background.secondary};
    border-color: ${theme.colors.border.weak};
    color: ${theme.colors.text.secondary};
  `,
});

const getInstalledBadgeColors = (theme: GrafanaTheme2) => ({
  installed: css`
    background: ${theme.colors.background.secondary};
    border-color: ${theme.colors.border.weak};
    color: ${theme.colors.text.secondary};
  `,
});
