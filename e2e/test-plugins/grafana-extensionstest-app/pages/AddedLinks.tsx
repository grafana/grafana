import { PluginPage, usePluginLinks } from '@grafana/runtime';

import { testIds } from '../testIds';
import { Stack } from '@grafana/ui';
import { ActionButton } from '../components/ActionButton';

export const LINKS_EXTENSION_POINT_ID = 'plugins/grafana-extensionstest-app/use-plugin-links/v1';

export function AddedLinks() {
  const { links } = usePluginLinks({ extensionPointId: LINKS_EXTENSION_POINT_ID });

  return (
    <PluginPage>
      <Stack direction={'column'} gap={4} data-testid={testIds.addedLinksPage.container}>
        <section data-testid={testIds.addedLinksPage.section1}>
          <h3>Link extensions defined with addLink and retrived using usePluginLinks</h3>
          <ActionButton extensions={links} />
        </section>
        {/* {isLoading ? (
          <div>Loading...</div>
        ) : (
          links.map(({ id, title, path, onClick }) => (
            <a href={path} title={title} key={id} onClick={onClick}>
              {title}
            </a>
          ))
        )} */}
      </Stack>
    </PluginPage>
  );
}
