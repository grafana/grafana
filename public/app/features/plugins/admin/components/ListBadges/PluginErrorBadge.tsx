import React from 'react';
import { PluginErrorCode } from '@grafana/data';
import { Badge } from '@grafana/ui';

type Props = { error: PluginErrorCode };

export function PluginErrorBadge({ error }: Props): React.ReactElement {
  return <Badge icon="exclamation-triangle" text="Broken" color="red" tooltip={errorCodeToTooltip(error)} />;
}

function errorCodeToTooltip(error: PluginErrorCode): string | undefined {
  switch (error) {
    case PluginErrorCode.modifiedSignature:
      return 'This plugin might have been tampered with and we recommend to remove and re-install before using it.';
    default:
      return;
  }
}
