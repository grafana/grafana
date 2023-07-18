import React from 'react';

import { Badge } from '@grafana/ui';

export function AngularPluginBadge(): React.ReactElement {
  return (
    <Badge
      icon="exclamation-triangle"
      text="Angular"
      color="orange"
      tooltip="This plugin uses deprecated functionality, support for which is being removed."
    />
  );
}
