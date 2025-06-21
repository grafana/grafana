import { testIds } from '../components/testIds';
import { PluginPage } from '@grafana/runtime';

function PageOne() {
  return (
    <PluginPage>
      <div data-testid={testIds.pageOne.container}>
        This app plugin is used to assert that provisioned dashboards work as expected.
      </div>
    </PluginPage>
  );
}

export default PageOne;
