import React from 'react';

import { Alert } from '@grafana/ui';

type Props = {
  className?: string;
  angularSupportEnabled?: boolean;
};

// An Alert showing information about Angular deprecation notice.
// If the plugin does not use Angular (!plugin.angularDetected), it returns null.
export function PluginDetailsAngularDeprecation({
  className,
  angularSupportEnabled,
}: Props): React.ReactElement | null {
  return (
    <Alert severity="warning" title="Angular plugin" className={className}>
      <p>
        This plugin uses a deprecated, legacy platform based on AngularJS and
        {angularSupportEnabled === undefined
          ? ' may be incompatible depending on your Grafana configuration.'
          : angularSupportEnabled
          ? ' will stop working in future releases of Grafana.'
          : ' is incompatible with your current Grafana configuration.'}
      </p>

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
