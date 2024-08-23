import { AppPlugin } from '@grafana/data';
import { App } from './components/App';

export const plugin = new AppPlugin<{}>()
  .setRootPage(App)
  .configureExtensionLink({
    title: 'Go to A',
    description: 'Navigating to pluging A',
    extensionPointId: 'plugins/grafana-extensionstest-app/actions',
    path: '/a/grafana-extensionexample1-app/',
  })
  .exposeComponent({
    id: 'grafana-extensionexample1-app/reusable-component/v1',
    title: 'Reusable component',
    description: 'A component that can be reused by other app plugins.',
    component: ({ name }: { name: string }) => <div data-testid="exposed-component">Hello {name}!</div>,
  });
