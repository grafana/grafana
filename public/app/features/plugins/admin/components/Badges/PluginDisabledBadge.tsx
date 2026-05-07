import * as React from 'react';

import { PluginErrorCode } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Badge } from '@grafana/ui';

type Props = { error?: PluginErrorCode };

export function PluginDisabledBadge({ error }: Props): React.ReactElement {
  const tooltip = errorCodeToTooltip(error);
  return (
    <Badge
      icon="exclamation-triangle"
      text={t('plugins.plugin-disabled-badge.text-disabled', 'Disabled')}
      color="red"
      tooltip={tooltip}
    />
  );
}

function errorCodeToTooltip(error?: PluginErrorCode): string | undefined {
  switch (error) {
    case PluginErrorCode.modifiedSignature:
      return 'Plugin disabled due to modified content';
    case PluginErrorCode.invalidSignature:
      return 'Plugin disabled due to invalid plugin signature';
    case PluginErrorCode.missingSignature:
      return 'Plugin disabled due to missing plugin signature';
    case null:
    case undefined:
      return 'Plugin disabled';
    default:
      return `Plugin disabled due to unknown error${error ? `: ${error}` : ''}`;
  }
}
