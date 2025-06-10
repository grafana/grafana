import { HTMLAttributes } from 'react';

import { PluginSignatureStatus, PluginSignatureType } from '@grafana/data';

import { IconName } from '../../types/icon';
import { Badge, BadgeProps } from '../Badge/Badge';

const SIGNATURE_ICONS: Record<string, IconName> = {
  [PluginSignatureType.grafana]: 'grafana',
  [PluginSignatureType.commercial]: 'shield',
  [PluginSignatureType.community]: 'shield',
  DEFAULT: 'shield-exclamation',
};

/**
 * @public
 */
export interface PluginSignatureBadgeProps extends HTMLAttributes<HTMLDivElement> {
  status?: PluginSignatureStatus;
  signatureType?: PluginSignatureType;
  signatureOrg?: string;
}

/**
 * @public
 */
export const PluginSignatureBadge = ({
  status,
  color,
  signatureType,
  signatureOrg,
  ...otherProps
}: PluginSignatureBadgeProps) => {
  const display = getSignatureDisplayModel(status, signatureType, signatureOrg);
  return (
    <Badge text={display.text} color={display.color} icon={display.icon} tooltip={display.tooltip} {...otherProps} />
  );
};

PluginSignatureBadge.displayName = 'PluginSignatureBadge';

function getSignatureDisplayModel(
  signature?: PluginSignatureStatus,
  signatureType?: PluginSignatureType,
  signatureOrg?: string
): BadgeProps {
  if (!signature) {
    signature = PluginSignatureStatus.invalid;
  }

  const signatureIcon = SIGNATURE_ICONS[signatureType || ''] || SIGNATURE_ICONS.DEFAULT;

  switch (signature) {
    case PluginSignatureStatus.internal:
      return { text: 'Core', color: 'blue', tooltip: 'Core plugin that is bundled with Grafana' };
    case PluginSignatureStatus.valid:
      return {
        text: signatureType ? signatureType : 'Signed',
        icon: signatureType ? signatureIcon : 'lock',
        color: 'green',
        tooltip: 'Signed and verified plugin',
      };
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
