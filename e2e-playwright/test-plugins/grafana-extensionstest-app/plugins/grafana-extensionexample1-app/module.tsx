import { AppPlugin, PluginExtensionPoints } from '@grafana/data';
import { Badge } from '@grafana/ui';

import { LINKS_EXTENSION_POINT_ID } from '../../pages/AddedLinks';
import { testIds } from '../../testIds';

import { App } from './components/App';

export const plugin = new AppPlugin<{}>()
  .setRootPage(App)
  .exposeComponent({
    id: 'grafana-extensionexample1-app/reusable-component/v1',
    title: 'Exposed component',
    description: 'A component that can be reused by other app plugins.',
    component: ({ name }: { name: string }) => <div data-testid={testIds.appB.exposedComponent}>Hello {name}!</div>,
  })
  .addLink({
    title: 'Basic link',
    description: '...',
    targets: [LINKS_EXTENSION_POINT_ID],
    path: '/a/grafana-extensionexample1-app/',
  })
  .addComponent({
    title: 'Dashboard owner',
    description: 'Shows a hello world owner on dashboard rows in the command palette',
    targets: [PluginExtensionPoints.CommandPaletteResultItem],
    component: () => <Badge text="Owner: Hello World" color="blue" data-testid={testIds.appB.commandPaletteOwner} />,
  })
  .addLink({
    title: 'Go to A',
    description: 'Navigating to pluging A',
    targets: [LINKS_EXTENSION_POINT_ID],
    path: '/a/grafana-extensionexample1-app/',
  });
