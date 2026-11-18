import { render, userEvent, waitFor } from 'test/test-utils';

import { testWithFlags } from '@grafana/test-utils/unstable';

import { AddControlsButton } from './ControlsAddButton';
import { DashboardDataLayerSet } from './DashboardDataLayerSet';
import { DashboardScene } from './DashboardScene';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceInstanceSettings: jest.fn().mockResolvedValue(undefined),
}));

function renderAddControls() {
  const dashboard = new DashboardScene({
    isEditing: true,
    $data: new DashboardDataLayerSet({ annotationLayers: [] }),
  });
  const sidebar = dashboard.state.sidebar;
  const deactivate = sidebar.activate();
  const user = userEvent.setup();
  const result = render(<AddControlsButton dashboard={dashboard} />);
  const elements = {
    addButton: () => result.getByRole('button', { name: 'Add' }),
    menuItem: (name: string) => result.getByRole('menuitem', { name }),
  };

  return {
    ...result,
    sidebar,
    deactivate,
    user,
    elements,
    actions: {
      async addElement(name: string) {
        await user.click(elements.addButton());
        await user.click(elements.menuItem(name));
      },
    },
  };
}

describe.each([false, true])('<AddControlsButton /> with explicit sidebar opening %s', (enabled) => {
  testWithFlags({ 'grafana.dashboardSidebarExplicitOpen': enabled });

  test.each([
    { menuItem: 'Link', expectedSelection: { linkIndex: 0 } },
    { menuItem: 'Annotation query', expectedSelection: { name: 'New annotation' } },
  ])(
    'when adding $menuItem with the sidebar closed, opens its configuration with autofocus requested',
    async ({ menuItem, expectedSelection }) => {
      const { sidebar, actions, unmount, deactivate } = renderAddControls();

      try {
        await actions.addElement(menuItem);

        await waitFor(() => expect(sidebar.getSelectedObject()?.state).toMatchObject(expectedSelection));
        expect(sidebar.state.openPane?.getId()).toBe('element');
        expect(sidebar.state.isNewElement).toBe(true);
      } finally {
        unmount();
        deactivate();
      }
    }
  );
});
