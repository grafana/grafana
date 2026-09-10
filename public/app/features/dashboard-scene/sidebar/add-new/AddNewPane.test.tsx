import { act, render, screen, testWithFeatureToggles } from 'test/test-utils';

import { store } from '@grafana/data';
import { Sidebar, useSidebar } from '@grafana/ui';
import { LS_PANEL_COPY_KEY } from 'app/core/constants';

import { DashboardDataLayerSet } from '../../scene/DashboardDataLayerSet';
import { DashboardScene } from '../../scene/DashboardScene';
import { clearClipboard } from '../../scene/layouts-shared/paste';

import { AddNewPane } from './AddNewPane';

describe('AddNewPane', () => {
  testWithFeatureToggles({ enable: ['dashboardNewLayouts'] });
  afterEach(() => act(clearClipboard));

  it('hides the paste chip during planning and restores it afterwards', () => {
    store.set(
      LS_PANEL_COPY_KEY,
      JSON.stringify({ title: 'Copied panel', type: 'timeseries', targets: [{ refId: 'A' }] })
    );
    const dashboard = new DashboardScene({ isEditing: true, $data: new DashboardDataLayerSet({}) });
    const pane = new AddNewPane({});
    dashboard.state.sidebar.setState({ openPane: pane });

    function Wrapper() {
      const sidebarContext = useSidebar({});
      return (
        <Sidebar contextValue={sidebarContext}>
          <pane.Component model={pane} />
        </Sidebar>
      );
    }
    render(<Wrapper />);

    expect(screen.getByText('Paste panel')).toBeInTheDocument();

    act(() => {
      dashboard.setState({
        planning: {
          planId: 'test-plan',
          planTitle: 'Preview',
          panelCount: 0,
          onBuild: jest.fn(),
          onDismiss: jest.fn(),
        },
      });
    });

    expect(screen.queryAllByRole('button', { name: 'Paste panel' })).toEqual([]);
    expect(screen.getByRole('button', { name: 'Panel' })).toBeInTheDocument();

    act(() => dashboard.setState({ planning: undefined }));

    expect(screen.getByText('Paste panel')).toBeInTheDocument();
  });
});
