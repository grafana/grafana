import React from 'react';

import { PluginExtensionPoints } from '@grafana/data';
import { getPluginComponentExtensions } from '@grafana/runtime';
import { Stack, Box, Text } from '@grafana/ui';

export function PluginIntegrations() {
  const { extensions } = getPluginComponentExtensions({
    extensionPointId: PluginExtensionPoints.AlertingHomePage,
    limitPerPlugin: 1,
  });

  if (extensions.length === 0) {
    return null;
  }

  return (
    <Stack direction="column" gap={2}>
      <Text element="h3" variant="h4">
        Speed up your alerts creation now by using one of our tailored apps
      </Text>
      <Stack gap={2} wrap="wrap" direction="row">
        {extensions.map((extension) => (
          <Box key={extension.id} backgroundColor="secondary" padding={2} flex={1} maxWidth="460px">
            <extension.component />
          </Box>
        ))}
      </Stack>
    </Stack>
  );
}
