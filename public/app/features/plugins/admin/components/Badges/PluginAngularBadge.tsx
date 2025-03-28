import * as React from 'react';

import { Badge } from '@grafana/ui';

export function PluginAngularBadge(): React.ReactElement {
  return (
    <Badge
      icon="exclamation-triangle"
      // eslint-disable-next-line @grafana/no-untranslated-strings
      text="Angular"
      color="orange"
      tooltip="This plugin uses deprecated functionality, support for which is being removed."
    />
  );
}
