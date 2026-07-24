import { type ComponentType } from 'react';

import { AppPlugin, type AppRootProps } from '@grafana/data';

const App: ComponentType<AppRootProps<{}>> = () => (
  <div data-testid="grafana-e2etest-app-root">Grafana E2ETest App</div>
);

export const plugin = new AppPlugin<{}>().setRootPage(App);
