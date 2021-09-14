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
      return 'This plugin might have been tampered with and we recommend you to remove and reinstall before using it.';
    case PluginErrorCode.invalidSignature:
      return 'This plugin seems to have an invalid signature. Try to remove and reinstall before using it.';
    default:
      return;
  }
}
