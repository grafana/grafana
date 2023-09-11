import React, { useState } from 'react';

import { Alert } from '@grafana/ui';

import { CatalogPlugin } from '../types';

type Props = {
  className?: string;
  plugin: CatalogPlugin;
};

export function PluginDetailsDeprecatedWarning(props: Props): React.ReactElement | null {
  const { className, plugin } = props;
  const [dismissed, setDismissed] = useState(false);
  const isWarningVisible = plugin.isDeprecated && !dismissed;

  return isWarningVisible ? (
    <Alert severity="warning" title="Deprecated" className={className} onRemove={() => setDismissed(true)}>
      <p>This {plugin.type} plugin is deprecated and removed from the catalog. No further updates will be made to the plugin.</p>
    </Alert>
  ) : null;
}
