import { testIds } from '../components/testIds';
import { PluginPage, usePluginComponent } from '@grafana/runtime';

type ReusableComponentProps = {
  name: string;
};

export function ExposedComponents() {
  var { component: ReusableComponent } = usePluginComponent<ReusableComponentProps>(
    'grafana-extensionexample1-app/reusable-component/v1'
  );

  if (!ReusableComponent) {
    return null;
  }

  return (
    <PluginPage>
      <div data-testid={testIds.pageTwo.container}>
        <ReusableComponent name={'World'} />
      </div>
    </PluginPage>
  );
}
