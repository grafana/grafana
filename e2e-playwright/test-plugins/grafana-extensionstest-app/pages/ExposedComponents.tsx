import { PluginPage, usePluginComponent } from '@grafana/runtime';

import { testIds } from '../testIds';

type ReusableComponentProps = {
  name: string;
};

export function ExposedComponents() {
  const { component: ReusableComponent } = usePluginComponent<ReusableComponentProps>(
    'grafana-extensionexample1-app/reusable-component/v1'
  );

  if (!ReusableComponent) {
    return null;
  }

  return (
    <PluginPage>
      <div data-testid={testIds.exposedComponentsPage.container}>
        <ReusableComponent name={'World'} />
      </div>
    </PluginPage>
  );
}
