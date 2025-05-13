import * as React from 'react';

import { Badge } from '@grafana/ui';
import { t } from 'app/core/internationalization';

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
