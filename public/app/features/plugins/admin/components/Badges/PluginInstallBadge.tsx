import * as React from 'react';

import { t } from '@grafana/i18n';
import { Badge, useStyles2 } from '@grafana/ui';

import { getBadgeColor } from './sharedStyles';

export function PluginInstalledBadge(): React.ReactElement {
  const customBadgeStyles = useStyles2(getBadgeColor);

  return (
    <Badge
      text={t('plugins.plugin-installed-badge.text-installed', 'Installed')}
      color="orange"
      className={customBadgeStyles}
    />
  );
}
