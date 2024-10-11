import {
  PluginPage,
  usePluginComponentExtensions,
  usePluginExtensions,
  usePluginLinkExtensions,
} from '@grafana/runtime';
import { Stack } from '@grafana/ui';

import { ActionButton } from '../components/ActionButton';
import { testIds } from '../testIds';

type AppExtensionContext = {};
type ReusableComponentProps = {
  name: string;
};

export function LegacyHooks() {
  const extensionPointId1 = 'plugins/grafana-extensionstest-app/actions';
  const extensionPointId2 = 'plugins/grafana-extensionstest-app/configure-extension-component/v1';
  const context: AppExtensionContext = {};

  const { extensions } = usePluginExtensions({
    extensionPointId: extensionPointId1,
    context,
  });

  const { extensions: linkExtensions } = usePluginLinkExtensions({
    extensionPointId: extensionPointId1,
  });

  const { extensions: componentExtensions } = usePluginComponentExtensions<ReusableComponentProps>({
    extensionPointId: extensionPointId2,
  });

  return (
    <PluginPage>
      <Stack direction={'column'} gap={4} data-testid={testIds.legacyHooksPage.container}>
        <section data-testid={testIds.legacyHooksPage.section1}>
          <h3>
            Link extensions defined with configureExtensionLink or configureExtensionComponent and retrived using
            usePluginExtensions
          </h3>
          <ActionButton extensions={extensions} />
        </section>
        <section data-testid={testIds.legacyHooksPage.section2}>
          <h3>Link extensions defined with configureExtensionLink and retrived using usePluginLinkExtensions</h3>
          <ActionButton extensions={linkExtensions} />
        </section>
        <section data-testid={testIds.legacyHooksPage.section3}>
          <h3>
            Component extensions defined with configureExtensionComponent and retrived using
            usePluginComponentExtensions
          </h3>
          {componentExtensions.map((extension) => {
            const Component = extension.component;
            return <Component key={extension.id} name="World" />;
          })}
        </section>
      </Stack>
    </PluginPage>
  );
}
