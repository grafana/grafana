import * as React from 'react';

import { t } from '@grafana/i18n';
import { featureEnabled } from '@grafana/runtime';
import { Badge, PluginSignatureBadge, Stack, useStyles2 } from '@grafana/ui';

import { CatalogPlugin } from '../../types';

import { getBadgeColor } from './sharedStyles';

type Props = { plugin: CatalogPlugin };

export function PluginEnterpriseBadge({ plugin }: Props): React.ReactElement {
  const customBadgeStyles = useStyles2(getBadgeColor);

  if (featureEnabled('enterprise.plugins')) {
    return <Badge text={t('plugins.plugin-enterprise-badge.text-enterprise', 'Enterprise')} color="blue" />;
  }

  return (
    <Stack wrap={'wrap'}>
      <PluginSignatureBadge status={plugin.signature} />
      <Badge
        icon="lock"
        role="img"
        aria-label={t('plugins.plugin-enterprise-badge.aria-label-enterprise', 'Enterprise')}
        text={t('plugins.plugin-enterprise-badge.text-enterprise', 'Enterprise')}
        color="blue"
        className={customBadgeStyles}
        title={t(
          'plugins.plugin-enterprise-badge.title-requires-a-grafana-enterprise-license',
          'Requires a Grafana Enterprise license'
        )}
      />
    </Stack>
  );
}
