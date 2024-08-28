import { PluginPage, usePluginLinks } from '@grafana/runtime';

import { testIds } from '../testIds';

export const LINKS_EXTENSION_POINT_ID = 'plugins/grafana-extensionstest-app/use-plugin-links/v1';

export function AddedLinks() {
  const { links, isLoading } = usePluginLinks({ extensionPointId: LINKS_EXTENSION_POINT_ID });

  return (
    <PluginPage>
      <div data-testid={testIds.addedLinksPage.container}>
        {isLoading ? (
          <div>Loading...</div>
        ) : (
          links.map(({ id, title, path, onClick }) => (
            <a href={path} title={title} key={id} onClick={onClick}>
              {title}
            </a>
          ))
        )}
      </div>
    </PluginPage>
  );
}
