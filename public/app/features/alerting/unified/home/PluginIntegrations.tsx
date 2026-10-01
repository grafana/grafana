import { Stack } from '@grafana/ui';

import { useAlertingHomePageExtensions } from '../plugins/useAlertingHomePageExtensions';

import { ContentBox } from './ContentBox';

export function PluginIntegrations() {
  const { components } = useAlertingHomePageExtensions();

  if (components.length === 0) {
    return null;
  }

  return (
    <Stack gap={2} wrap="wrap" direction="row">
      {components.map((Component, i) => (
        <ContentBox key={i} flex={1} maxWidth="460px">
          <Component />
        </ContentBox>
      ))}
    </Stack>
  );
}
