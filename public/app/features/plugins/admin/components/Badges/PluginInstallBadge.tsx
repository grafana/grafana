import React from 'react';

import { Badge, useStyles2 } from '@grafana/ui';

import { getBadgeColor } from './sharedStyles';

export function PluginInstalledBadge(): React.ReactElement {
  const customBadgeStyles = useStyles2(getBadgeColor);
  return <Badge text="Installed" color="orange" className={customBadgeStyles} />;
}
