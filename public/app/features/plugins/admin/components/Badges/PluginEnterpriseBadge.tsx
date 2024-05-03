import React from 'react';

import { featureEnabled } from '@grafana/runtime';
import { Badge, PluginSignatureBadge, Stack, TextLink, useStyles2 } from '@grafana/ui';

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
      />
      <TextLink
        external={true}
        inline={false}
        href={`https://grafana.com/grafana/plugins/${plugin.id}?utm_source=grafana_catalog_learn_more`}
      >
        Learn more
      </TextLink>
    </Stack>
  );
}
