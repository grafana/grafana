import React from 'react';
import { getExternalManageLink } from '../../helpers';
import { HorizontalGroup, LinkButton } from '@grafana/ui';

type ExternallyManagedButtonProps = {
  pluginId: string;
  pluginStatus: 'install' | 'update' | 'uninstall';
};

export function ExternallyManagedButton({ pluginId, pluginStatus }: ExternallyManagedButtonProps) {
  const externalManageLink = getExternalManageLink(pluginId);

  if (pluginStatus === 'update') {
    return (
      <HorizontalGroup height="auto">
        <LinkButton href={externalManageLink} target="_blank" rel="noopener noreferrer">
          {'Update via grafana.com'}
        </LinkButton>
        <LinkButton variant="destructive" href={externalManageLink} target="_blank" rel="noopener noreferrer">
          {'Uninstall via grafana.com'}
        </LinkButton>
      </HorizontalGroup>
    );
  }

  if (pluginStatus === 'uninstall') {
    return (
      <LinkButton variant="destructive" href={externalManageLink} target="_blank" rel="noopener noreferrer">
        {'Uninstall via grafana.com'}
      </LinkButton>
    );
  }

  return (
    <LinkButton href={externalManageLink} target="_blank" rel="noopener noreferrer">
      {'Install via grafana.com'}
    </LinkButton>
  );
}
