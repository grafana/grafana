import React from 'react';
import { Badge, BadgeProps } from '@grafana/ui';
import { PluginSignatureStatus } from '@grafana/data';

interface Props {
  status: PluginSignatureStatus;
}

export const PluginSignatureBadge: React.FC<Props> = ({ status }) => {
  const display = getSignatureDisplayModel(status);
  return <Badge text={display.text} color={display.color} icon={display.icon} tooltip={display.tooltip} />;
};

function getSignatureDisplayModel(signature: PluginSignatureStatus): BadgeProps {
  switch (signature) {
    case PluginSignatureStatus.internal:
      return { text: 'Core', icon: 'cube', color: 'blue', tooltip: 'Core plugin that is bundled with Grafana' };
    case PluginSignatureStatus.valid:
      return { text: 'Signed', icon: 'lock', color: 'green', tooltip: 'Signed and verified plugin' };
    case PluginSignatureStatus.invalid:
      return {
        text: 'Invalid',
        icon: 'exclamation-triangle',
        color: 'red',
        tooltip: 'Invalid plugin signature',
      };
    case PluginSignatureStatus.modified:
      return {
        text: 'Modified',
        icon: 'exclamation-triangle',
        color: 'red',
        tooltip: 'Valid signature but content has been modified',
      };
  }

  return { text: 'Unsigned', icon: 'exclamation-triangle', color: 'red', tooltip: 'Unsigned external plugin' };
}

PluginSignatureBadge.displayName = 'PluginSignatureBadge';
