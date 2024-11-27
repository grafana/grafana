import { PluginPage, usePluginLinks } from '@grafana/runtime';
import { Stack } from '@grafana/ui';

import { ActionButton } from '../components/ActionButton';
import { testIds } from '../testIds';

export const LINKS_EXTENSION_POINT_ID = 'plugins/grafana-extensionstest-app/use-plugin-links/v1';

export function AddedLinks() {
  const { links } = usePluginLinks({ extensionPointId: LINKS_EXTENSION_POINT_ID });

  return (
    <PluginPage>
      <Stack direction={'column'} gap={4} data-testid={testIds.addedLinksPage.container}>
        <section data-testid={testIds.addedLinksPage.section1}>
          <h3>Link extensions defined with addLink and retrieved using usePluginLinks</h3>
          <ActionButton extensions={links} />
        </section>
      </Stack>
    </PluginPage>
  );
}
