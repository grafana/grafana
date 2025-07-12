import { usePluginLinks } from '@grafana/runtime';
import { Stack } from '@grafana/ui';
import { testIds } from '../../../../testIds';
import { ActionButton } from '../../../../components/ActionButton';

export const LINKS_EXTENSION_POINT_ID = 'plugins/grafana-extensionstest-app/use-plugin-links/v1';

export function AddedLinks() {
  const { links } = usePluginLinks({ extensionPointId: LINKS_EXTENSION_POINT_ID });
  return (
    <Stack direction={'column'} gap={4}>
      <section data-testid={testIds.appC.section1}>
        <h3>Link extensions defined with addLink and retrieved using usePluginLinks</h3>
        <ActionButton extensions={links} />
      </section>
    </Stack>
  );
}
