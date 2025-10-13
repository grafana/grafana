import * as React from 'react';

import { Badge } from '@grafana/ui';

export function PluginDeprecatedBadge(): React.ReactElement {
  return (
    <Badge
      icon="exclamation-triangle"
      text="Deprecated"
      color="orange"
      tooltip="This plugin is deprecated and no longer receives updates."
    />
  );
}
