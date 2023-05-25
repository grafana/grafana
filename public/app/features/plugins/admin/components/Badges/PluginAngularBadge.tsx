import React from 'react';

import { PluginErrorCode } from '@grafana/data';
import { Badge } from '@grafana/ui';

type Props = { error?: PluginErrorCode };

export function PluginAngularBadge({ error }: Props): React.ReactElement {
  return <Badge icon="exclamation-triangle" text="Angular" color="orange" tooltip="Legacy Angular plugin" />;
}
