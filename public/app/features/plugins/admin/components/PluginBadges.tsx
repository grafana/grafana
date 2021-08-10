import React from 'react';
import { css } from '@emotion/css';
import { Badge, Button, HorizontalGroup, PluginSignatureBadge, useStyles2 } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { CatalogPlugin } from '../types';

type PluginBadgeType = {
  plugin: CatalogPlugin;
};

export function PluginBadges({ plugin }: PluginBadgeType) {
  if (plugin.isEnterprise) {
    return <EnterpriseBadge id={plugin.id} />;
  }
  return (
    <HorizontalGroup>
      <PluginSignatureBadge status={plugin.signature} />
      {plugin.isInstalled && <InstalledBadge />}
    </HorizontalGroup>
  );
}

function EnterpriseBadge({ id }: { id: string }) {
  const customBadgeStyles = useStyles2(getBadgeColor);
  const onClick = (ev: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    ev.preventDefault();
    window.open(
      `https://grafana.com/grafana/plugins/${id}?utm_source=grafana_catalog_learn_more`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  if (config.licenseInfo?.hasValidLicense) {
    return <Badge text="Enterprise" color="blue" />;
  }

  return (
    <HorizontalGroup>
      <Badge icon="lock" aria-label="lock icon" text="Enterprise" color="blue" className={customBadgeStyles} />
      <Button size="sm" fill="text" icon="external-link-alt" onClick={onClick}>
        Learn more
      </Button>
    </HorizontalGroup>
  );
}

function InstalledBadge() {
  const customBadgeStyles = useStyles2(getBadgeColor);
  return <Badge text="Installed" color="orange" className={customBadgeStyles} />;
}

const getBadgeColor = (theme: GrafanaTheme2) => css`
  background: ${theme.colors.background.primary};
  border-color: ${theme.colors.border.strong};
  color: ${theme.colors.text.secondary};
`;
