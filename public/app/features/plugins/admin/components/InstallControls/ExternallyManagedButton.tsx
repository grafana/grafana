import React from 'react';

import { config } from '@grafana/runtime';
import { HorizontalGroup, LinkButton } from '@grafana/ui';

import { getExternalManageLink } from '../../helpers';
import { PluginStatus } from '../../types';

type ExternallyManagedButtonProps = {
  pluginId: string;
  pluginStatus: PluginStatus;
  angularDetected?: boolean;
};

export function ExternallyManagedButton({ pluginId, pluginStatus, angularDetected }: ExternallyManagedButtonProps) {
  const externalManageLink = `${getExternalManageLink(pluginId)}/?tab=installation`;

  if (pluginStatus === PluginStatus.UPDATE) {
    return (
      <HorizontalGroup height="auto">
        <LinkButton href={externalManageLink} target="_blank" rel="noopener noreferrer">
          Update via grafana.com
        </LinkButton>
        <LinkButton variant="destructive" href={externalManageLink} target="_blank" rel="noopener noreferrer">
          Uninstall via grafana.com
        </LinkButton>
      </HorizontalGroup>
    );
  }

  if (pluginStatus === PluginStatus.UNINSTALL) {
    return (
      <LinkButton variant="destructive" href={externalManageLink} target="_blank" rel="noopener noreferrer">
        Uninstall via grafana.com
      </LinkButton>
    );
  }

  return (
    <LinkButton
      disabled={!config.angularSupportEnabled && angularDetected}
      href={externalManageLink}
      target="_blank"
      rel="noopener noreferrer"
    >
      Install via grafana.com
    </LinkButton>
  );
}
