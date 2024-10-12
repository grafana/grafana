import { PluginPage, usePluginComponents } from '@grafana/runtime';
import { Stack } from '@grafana/ui';

import { testIds } from '../testIds';

type ReusableComponentProps = {
  name: string;
};

export function AddedComponents() {
  const { components } = usePluginComponents<ReusableComponentProps>({
    extensionPointId: 'plugins/grafana-extensionstest-app/addComponent/v1',
  });

  return (
    <PluginPage>
      <Stack direction={'column'} gap={4} data-testid={testIds.addedComponentsPage.container}>
        <article>
          <h3>Component extensions defined with addComponent and retrived with usePluginComponents hook</h3>
          {components.map((Component, i) => {
            return <Component key={i} name="World" />;
          })}
        </article>
      </Stack>
    </PluginPage>
  );
}
