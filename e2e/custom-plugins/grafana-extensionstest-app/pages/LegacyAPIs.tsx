import { testIds } from '../components/testIds';
import { PluginPage, getPluginComponentExtensions, getPluginExtensions } from '@grafana/runtime';
import { ActionButton } from '../components/ActionButton';
import { Stack } from '@grafana/ui';

type AppExtensionContext = {};
type ReusableComponentProps = {
  name: string;
};

export function LegacyAPIs() {
  const extensionPointId = 'plugins/grafana-extensionstest-app/actions';
  const context: AppExtensionContext = {};

  const { extensions } = getPluginExtensions({
    extensionPointId,
    context,
  });

  const { extensions: componentExtensions } = getPluginComponentExtensions<ReusableComponentProps>({
    extensionPointId: 'plugins/grafana-extensionexample2-app/configure-extension-component/v1',
  });

  return (
    <PluginPage>
      <Stack direction={'column'} gap={4} data-testid={testIds.pageTwo.container}>
        <article>
          <h3>Link extensions defined with configureExtensionLink and retrived using getPluginExtensions</h3>
          <ActionButton extensions={extensions} />
        </article>
        <article>
          <h3>
            Component extensions defined with configureExtensionComponent and retrived using
            getPluginComponentExtensions
          </h3>
          {componentExtensions.map((extension) => {
            const Component = extension.component;
            return <Component key={extension.id} name="World" />;
          })}
        </article>
      </Stack>
    </PluginPage>
  );
}
