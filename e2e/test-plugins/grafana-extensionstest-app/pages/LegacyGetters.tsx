import {
  PluginPage,
  getPluginComponentExtensions,
  getPluginExtensions,
  getPluginLinkExtensions,
} from '@grafana/runtime';
import { Stack } from '@grafana/ui';

import { ActionButton } from '../components/ActionButton';
import { testIds } from '../testIds';

type AppExtensionContext = {};
type ReusableComponentProps = {
  name: string;
};

export function LegacyGetters() {
  const extensionPointId1 = 'plugins/grafana-extensionstest-app/actions';
  const extensionPointId2 = 'plugins/grafana-extensionstest-app/configure-extension-component/v1';
  const context: AppExtensionContext = {};

  const { extensions } = getPluginExtensions({
    extensionPointId: extensionPointId1,
    context,
  });

  const { extensions: linkExtensions } = getPluginLinkExtensions({
    extensionPointId: extensionPointId1,
  });

  const { extensions: componentExtensions } = getPluginComponentExtensions<ReusableComponentProps>({
    extensionPointId: extensionPointId2,
  });

  return (
    <PluginPage>
      <Stack direction={'column'} gap={4} data-testid={testIds.legacyGettersPage.container}>
        <section data-testid={testIds.legacyGettersPage.section1}>
          <h3>
            Link extensions defined with configureExtensionLink or configureExtensionComponent and retrived using
            getPluginExtensions
          </h3>
          <ActionButton extensions={extensions} />
        </section>
        <section data-testid={testIds.legacyGettersPage.section2}>
          <h3>Link extensions defined with configureExtensionLink and retrived using getPluginLinkExtensions</h3>
          <ActionButton extensions={linkExtensions} />
        </section>
        <section data-testid={testIds.legacyGettersPage.section3}>
          <h3>
            Component extensions defined with configureExtensionComponent and retrived using
            getPluginComponentExtensions
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
