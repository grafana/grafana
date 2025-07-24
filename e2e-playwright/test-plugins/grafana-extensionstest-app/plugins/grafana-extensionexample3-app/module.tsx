import { AppPlugin } from '@grafana/data';

import { LINKS_EXTENSION_POINT_ID } from '../../pages/AddedLinks';
import { testIds } from '../../testIds';
import { App } from '../../components/App';

export const plugin = new AppPlugin<{}>()
  .setRootPage(App)
  .addComponent<{ name: string }>({
    targets: ['plugins/grafana-extensionstest-app/addComponent/v1'],
    title: 'Added component (where meta data is missing)',
    description: '.',
    component: ({ name }: { name: string }) => (
      <div data-testid={testIds.appB.reusableAddedComponent}>Hello {name}!</div>
    ),
  })
  .addLink({
    title: 'Added link (where meta data is missing)',
    description: '.',
    targets: [LINKS_EXTENSION_POINT_ID],
    onClick: (_, { openModal }) => {
      openModal({
        title: 'Modal from app C',
        body: () => <div data-testid={testIds.appB.modal}>From plugin B</div>,
      });
    },
  });
