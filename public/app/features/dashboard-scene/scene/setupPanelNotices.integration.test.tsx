import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { EventBusSrv, getDefaultTimeRange, LoadingState, type PanelData } from '@grafana/data';
import { SceneDataNode, SceneDataTransformer, VizPanel } from '@grafana/scenes';
import { PanelChrome, PanelContextProvider, type PanelContext } from '@grafana/ui';

import { setupPanelNotices } from './setupPanelNotices';

it('keeps the error icon and popover current across data-provider rendering lifetimes', async () => {
  const initialData: PanelData = { series: [], state: LoadingState.Done, timeRange: getDefaultTimeRange() };
  const source = new SceneDataNode({ data: initialData });
  const data = new SceneDataTransformer({ $data: source, transformations: [] });
  const panel = new VizPanel({ $data: data });
  const context: PanelContext = { eventsScope: 'panel', eventBus: new EventBusSrv() };
  setupPanelNotices(panel, context);
  const leaveDashboard = data.activate();
  const closeInspector = context.activateNotices!();

  function Preview() {
    const state = data.useState();
    return (
      <PanelContextProvider value={context}>
        <PanelChrome
          width={400}
          height={200}
          title="Detail Stats"
          statusItems={state.data?.errors?.map((error) => ({ severity: 'error', text: error.message! }))}
        >
          {() => <div>No data</div>}
        </PanelChrome>
      </PanelContextProvider>
    );
  }

  const view = render(<Preview />);
  expect(screen.getByText('No data')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Panel status' })).not.toBeInTheDocument();
  act(() => leaveDashboard());
  let leaveEditor!: () => void;
  act(() => {
    leaveEditor = data.activate();
  });
  view.rerender(<Preview key="editor" />);
  act(() => {
    source.setState({
      data: { ...initialData, state: LoadingState.Error, errors: [{ refId: 'A', message: 'Invalid FROM clause' }] },
    });
  });
  await userEvent.click(await screen.findByRole('button', { name: 'Panel status' }));
  expect(await screen.findByText('Invalid FROM clause')).toBeVisible();
  act(() => source.setState({ data: initialData }));
  expect(screen.getByText('No data')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Panel status' })).not.toBeInTheDocument();

  view.unmount();
  closeInspector();
  leaveEditor();
  expect(data.isActive).toBe(false);
  expect(source.isActive).toBe(false);
});
