import * as React from 'react';

import { t } from '@grafana/i18n';
import { Badge } from '@grafana/ui';

export function PluginDeprecatedBadge(): React.ReactElement {
  return (
    <Badge
      icon="exclamation-triangle"
      text={t('plugins.plugin-deprecated-badge.text-deprecated', 'Deprecated')}
      color="orange"
      tooltip={t(
        'plugins.plugin-deprecated-badge.tooltip-plugin-deprecated-longer-receives-updates',
        'This plugin is deprecated and no longer receives updates.'
      )}
    />
  );
}
