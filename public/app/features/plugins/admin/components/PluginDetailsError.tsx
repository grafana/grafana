import React from 'react';
import { PluginErrorCode } from '@grafana/data';
import { Alert } from '@grafana/ui';
import { CatalogPlugin } from '../types';

type Props = {
  className?: string;
  plugin: CatalogPlugin;
};

export function PluginDetailsError({ className, plugin }: Props): React.ReactElement | null {
  const isBroken = !!plugin.error;

  if (!isBroken) {
    return null;
  }

  return (
    <Alert severity="error" title="Invalid plugin installation" className={className}>
      {plugin.error === PluginErrorCode.modifiedSignature && (
        <p>
          Grafana Labs checks each plugin to verify that it has a valid digital signature. While doing this, we
          discovered that the content of this plugin does not match its signature. We can not guarrantee the trustworthy
          of this plugin and recommend you to remove it and reinstall it before further use.
        </p>
      )}
    </Alert>
  );
}
