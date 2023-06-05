import React, { HTMLAttributes } from 'react';

import { PluginSignatureStatus } from '@grafana/data';

import { Badge, BadgeProps } from '../Badge/Badge';

/**
 * @public
 */
export interface PluginSignatureBadgeProps extends HTMLAttributes<HTMLDivElement> {
  status?: PluginSignatureStatus;
}

/**
 * @public
 */
export const PluginSignatureBadge = ({ status, ...otherProps }: PluginSignatureBadgeProps) => {
  const display = getSignatureDisplayModel(status);
  return (
    <Badge
      text={display.text}
      color={display.color as any}
      icon={display.icon}
      tooltip={display.tooltip}
      {...otherProps}
    />
  );
};

PluginSignatureBadge.displayName = 'PluginSignatureBadge';

function getSignatureDisplayModel(signature?: PluginSignatureStatus): BadgeProps {
  if (!signature) {
    signature = PluginSignatureStatus.invalid;
  }

  switch (signature) {
    case PluginSignatureStatus.internal:
      return { text: 'Core', color: 'blue', tooltip: 'Core plugin that is bundled with Grafana' };
    case PluginSignatureStatus.valid:
      return { text: 'Signed', icon: 'lock', color: 'green', tooltip: 'Signed and verified plugin' };
    case PluginSignatureStatus.invalid:
      return {
        text: 'Invalid signature',
        icon: 'exclamation-triangle',
        color: 'red',
        tooltip: 'Invalid plugin signature',
      };
    case PluginSignatureStatus.modified:
      return {
        text: 'Modified signature',
        icon: 'exclamation-triangle',
        color: 'red',
        tooltip: 'Valid signature but content has been modified',
      };
    case PluginSignatureStatus.missing:
      return {
        text: 'Missing signature',
        icon: 'exclamation-triangle',
        color: 'red',
        tooltip: 'Missing plugin signature',
      };
    default:
      return {
        text: 'Unsigned',
        icon: 'exclamation-triangle',
        color: 'red',
        tooltip: 'Unsigned external plugin',
      };
  }
}
