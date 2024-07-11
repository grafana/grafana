import React from 'react';

import { PageInfoItem } from '@grafana/runtime/src/components/PluginPage';
import { TextLink, Stack, Text } from '@grafana/ui';

import { CatalogPlugin } from '../types';

type Props = {
  info: PageInfoItem[];
  plugin: CatalogPlugin;
};

export function PluginDetailsRightPanel(props: Props): React.ReactElement | null {
  const { info, plugin } = props;

  return (
    <div style={{ width: '20%' }}>
      <Stack direction="column" gap={2}>
        {info.map((infoItem, index) => {
          return (
            <div key={index}>
              <Text color="secondary">{infoItem.label}: </Text>
              <div>{infoItem.value}</div>
            </div>
          );
        })}

        <div>
          <Text color="secondary">Last updated: </Text>
          <Text>{new Date(plugin.updatedAt).toLocaleDateString()}</Text>
        </div>

        {plugin?.details?.links && plugin.details.links.length > 0 && (
          <Stack direction="column" gap={2}>
            {plugin.details.links.map((link, index) => (
              <div key={index}>
                <TextLink href={link.url} external>
                  {link.name}
                </TextLink>
              </div>
            ))}
          </Stack>
        )}

        <TextLink href="mailto:integrations@grafana.com" external>
          Report Abuse
        </TextLink>
      </Stack>
    </div>
  );
}
