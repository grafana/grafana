import React from 'react';
import { PluginSignatureErrorCode } from '@grafana/data';
import { Badge } from '@grafana/ui';

type Props = { error?: PluginSignatureErrorCode };

export function PluginDisabledBadge({ error }: Props): React.ReactElement {
  const tooltip = errorCodeToTooltip(error);
  return <Badge icon="exclamation-triangle" text="Disabled" color="red" tooltip={tooltip} />;
}

function errorCodeToTooltip(error?: PluginSignatureErrorCode): string | undefined {
  switch (error) {
    case PluginSignatureErrorCode.modifiedSignature:
      return 'Plugin disabled due to modified content';
    case PluginSignatureErrorCode.invalidSignature:
      return 'Plugin disabled due to invalid plugin signature';
    case PluginSignatureErrorCode.missingSignature:
      return 'Plugin disabled due to missing plugin signature';
    default:
      return `Plugin disabled due to unkown error: ${error}`;
  }
}
