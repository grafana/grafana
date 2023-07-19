import React from 'react';

import { Alert } from '@grafana/ui';

type Props = {
  className?: string;
  angularSupportEnabled?: boolean;
};

function deprecationMessage(angularSupportEnabled?: boolean): string {
  const msg = 'This plugin uses a deprecated, legacy platform based on AngularJS and ';
  if (angularSupportEnabled === undefined) {
    return msg + ' may be incompatible depending on your Grafana configuration.';
  }
  if (angularSupportEnabled) {
    return msg + ' will stop working in future releases of Grafana.';
  }
  return msg + ' is incompatible with your current Grafana configuration.';
}

// An Alert showing information about Angular deprecation notice.
// If the plugin does not use Angular (!plugin.angularDetected), it returns null.
export function PluginDetailsAngularDeprecation({
  className,
  angularSupportEnabled,
}: Props): React.ReactElement | null {
  return (
    <Alert severity="warning" title="Angular plugin" className={className}>
      <p>{deprecationMessage(angularSupportEnabled)}</p>
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
