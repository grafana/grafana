import React from 'react';

import { Alert } from '@grafana/ui';

type Props = {
  className?: string;
};

// An Alert showing information about Angular deprecation notice.
// If the plugin does not use Angular (!plugin.angularDetected), it returns null.
export function PluginDetailsAngularDeprecation({ className }: Props): React.ReactElement | null {
  return (
    <Alert severity="warning" title="Angular plugin" className={className}>
      <p>This plugin is using deprecated plugin APIs.</p>

      <a
        href="https://grafana.com/docs/grafana/latest/developers/angular_deprecation/"
        className="external-link"
        target="_blank"
        rel="noreferrer"
      >
        Read more about Angular support deprecation.
      </a>
    </Alert>
  );
}
