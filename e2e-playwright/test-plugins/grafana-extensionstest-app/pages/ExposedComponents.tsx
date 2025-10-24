import { PluginPage, usePluginComponent } from '@grafana/runtime';

import { testIds } from '../testIds';

type ReusableComponentProps = {
  name: string;
};

export function ExposedComponents() {
  const { component: ReusableComponent } = usePluginComponent<ReusableComponentProps>(
    'grafana-extensionexample1-app/reusable-component/v1'
  );
  const { component: AddToDashboardForm } = usePluginComponent('grafana/add-to-dashboard-form/v1');

  if (!ReusableComponent) {
    return null;
  }

  return (
    <PluginPage>
      <div data-testid={testIds.exposedComponentsPage.container}>
        <ReusableComponent name={'World'} />
      </div>
      {AddToDashboardForm && (
        <section>
          <h3>Save to dashboard (exposed form)</h3>
          <AddToDashboardForm
            // Create a recognizable panel for assertion
            buildPanel={() => ({
              type: 'timeseries',
              title: 'E2E Add to Dashboard Panel',
              gridPos: { x: 0, y: 0, w: 8, h: 6 },
              targets: [],
            })}
            // Ensure navigation works correctly from plugin page
            options={{ useAbsolutePath: true }}
            onClose={() => {}}
          />
        </section>
      )}
    </PluginPage>
  );
}
