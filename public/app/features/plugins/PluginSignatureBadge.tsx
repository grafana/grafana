import React, { HTMLAttributes } from 'react';
import { Badge, BadgeProps } from '@grafana/ui';
import { PluginErrorCode, PluginSignatureStatus } from '@grafana/data';

interface Props extends HTMLAttributes<HTMLDivElement> {
  status?: PluginSignatureStatus;
}

export const PluginSignatureBadge: React.FC<Props> = ({ status, ...otherProps }) => {
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

export function isUnsignedPluginSignature(signature?: PluginSignatureStatus) {
  return signature && signature !== PluginSignatureStatus.valid && signature !== PluginSignatureStatus.internal;
}

export function mapPluginErrorCodeToSignatureStatus(code: PluginErrorCode) {
  switch (code) {
    case PluginErrorCode.invalidSignature:
      return PluginSignatureStatus.invalid;
    case PluginErrorCode.missingSignature:
      return PluginSignatureStatus.missing;
    case PluginErrorCode.modifiedSignature:
      return PluginSignatureStatus.modified;
    default:
      return PluginSignatureStatus.missing;
  }
}

function getSignatureDisplayModel(signature?: PluginSignatureStatus): BadgeProps {
  if (!signature) {
    signature = PluginSignatureStatus.invalid;
  }

  switch (signature) {
    case PluginSignatureStatus.internal:
      return { text: 'Core', icon: 'cube', color: 'blue', tooltip: 'Core plugin that is bundled with Grafana' };
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
  }

  return { text: 'Unsigned', icon: 'exclamation-triangle', color: 'red', tooltip: 'Unsigned external plugin' };
}

PluginSignatureBadge.displayName = 'PluginSignatureBadge';
