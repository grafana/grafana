import React from 'react';

import { Alert } from '@grafana/ui';

import { CatalogPlugin } from '../types';

type Props = {
  className?: string;
  plugin: CatalogPlugin;
};

// An Alert showing information about Angular deprecation notice.
// If the plugin does not use Angular (!plugin.angularDetected), it returns null.
export function PluginDetailsAngularDeprecation({ plugin, className }: Props): React.ReactElement | null {
  if (!plugin.angularDetected) {
    return null;
  }
  return (
    <Alert severity="warning" title="Angular plugin" className={className}>
      <p>
        Lorem ipsum dolor sit amet consectetur adipisicing elit. Sit natus, corrupti officia velit quidem culpa, impedit
        ut illum labore recusandae molestiae aliquid iusto accusantium sed quisquam vel saepe, ipsa nisi.
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
