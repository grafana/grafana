import * as React from 'react';

import { featureEnabled } from '@grafana/runtime';
import { Badge, PluginSignatureBadge, Stack, useStyles2 } from '@grafana/ui';

import { CatalogPlugin } from '../../types';

import { getBadgeColor } from './sharedStyles';

type Props = { plugin: CatalogPlugin };

export function PluginEnterpriseBadge({ plugin }: Props): React.ReactElement {
  const customBadgeStyles = useStyles2(getBadgeColor);

  if (featureEnabled('enterprise.plugins')) {
    return <Badge text="Enterprise" color="blue" />;
  }

  return (
    <Stack wrap={'wrap'}>
      <PluginSignatureBadge status={plugin.signature} />
      <Badge
        icon="lock"
        role="img"
        aria-label="lock icon"
        text="Enterprise"
        color="blue"
        className={customBadgeStyles}
        title="Requires a Grafana Enterprise license"
      />
    </Stack>
  );
}
