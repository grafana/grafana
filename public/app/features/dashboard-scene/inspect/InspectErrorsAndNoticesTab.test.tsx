import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DataSourceApi, EventBusSrv, getDefaultTimeRange, LoadingState } from '@grafana/data';
import { PanelStatusStore } from '@grafana/data/internal';
import { SceneDataNode, VizPanel } from '@grafana/scenes';
import type { PanelContext } from '@grafana/ui';

import { InspectErrorsAndNoticesTab } from './InspectErrorsAndNoticesTab';

class CustomDatasource extends DataSourceApi {
  query = jest.fn();
  testDatasource = jest.fn();
  components = { ErrorsAndNoticesInspector: () => <div>Datasource details</div> };
}

it('shows plugin-load errors even without a notice store or query data', () => {
  const panel = new VizPanel({ $data: new SceneDataNode({}), _pluginLoadError: 'Plugin failed to load' });
  const tab = new InspectErrorsAndNoticesTab({ panelRef: panel.getRef() });
  render(<tab.Component model={tab} />);
  expect(screen.getByText('Plugin failed to load')).toBeVisible();
});

it('shows query errors before host initialization and respects an initialized empty store', () => {
  const store = new PanelStatusStore();
  store.createSource().set([{ id: 'panel', severity: 'warning', text: 'Choose field' }]);
  const panel = new VizPanel({
    $data: new SceneDataNode({
      data: {
        series: [],
        state: LoadingState.Error,
        timeRange: getDefaultTimeRange(),
        errors: [{ message: 'Query failed' }],
      },
    }),
    extendPanelContext: (_, context) => {
      context.notices = store;
    },
  });
  const tab = new InspectErrorsAndNoticesTab({ panelRef: panel.getRef() });
  render(<tab.Component model={tab} />);
  expect(screen.getByText('Query failed')).toBeVisible();
  expect(screen.getByText('Choose field')).toBeVisible();
  act(() => store.setExternal([]));
  expect(screen.getByText('Choose field')).toBeVisible();
  expect(screen.queryByText('Query failed')).not.toBeInTheDocument();
  act(() => store.clear());
  expect(screen.getByText('Query failed')).toBeVisible();
  act(() => store.setExternal([]));
  expect(screen.getByText('No errors or notices for this panel.')).toBeVisible();
  expect(screen.queryByText('Query failed')).not.toBeInTheDocument();
});

it('shows Assistant in an open inspector when availability arrives after its notice', () => {
  const store = new PanelStatusStore();
  store.createSource().set([{ id: 'late', severity: 'error', text: 'Query failed' }]);
  const context: PanelContext = { notices: store, eventsScope: 'panel', eventBus: new EventBusSrv() };
  const panel = new VizPanel({
    $data: new SceneDataNode({}),
    extendPanelContext: (_, target) => Object.assign(target, context),
  });
  const tab = new InspectErrorsAndNoticesTab({ panelRef: panel.getRef() });
  render(<tab.Component model={tab} />);
  expect(screen.getByText('Query failed')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Fix with Assistant' })).not.toBeInTheDocument();

  const investigate = jest.fn();
  act(() => {
    panel.getPanelContext().onInvestigateStatusItem = investigate;
    store.refresh();
  });
  expect(screen.getByRole('button', { name: 'Fix with Assistant' })).toBeVisible();
});

it('shows panel notices alongside the custom datasource inspector and closes only for Assistant', async () => {
  const store = new PanelStatusStore();
  const source = store.createSource();
  const onClick = jest.fn();
  source.set([
    {
      id: 'field',
      severity: 'warning',
      text: 'Choose a numeric field',
      actions: [{ id: 'choose', label: 'Choose field', onClick }],
    },
  ]);
  const onInvestigateStatusItem = jest.fn(() =>
    expect(store.getSnapshot().items[0].text).toBe('Choose a numeric field')
  );
  const onClose = jest.fn(() => store.clear());
  const context: PanelContext = {
    notices: store,
    eventsScope: 'panel',
    eventBus: new EventBusSrv(),
    onInvestigateStatusItem,
  };
  const panel = new VizPanel({
    $data: new SceneDataNode({
      data: {
        series: [],
        errors: [{ message: 'Custom query error' }],
        state: LoadingState.Error,
        timeRange: getDefaultTimeRange(),
      },
    }),
    extendPanelContext: (_, target) => Object.assign(target, context),
  });
  const datasource = new CustomDatasource({
    id: 1,
    uid: 'test',
    type: 'test',
    name: 'Test',
    access: 'proxy',
    readOnly: false,
    meta: {} as DataSourceApi['meta'],
    jsonData: {},
  });
  const tab = new InspectErrorsAndNoticesTab({ panelRef: panel.getRef(), dataSource: datasource, onClose });
  render(<tab.Component model={tab} />);
  expect(screen.getByText('Datasource details')).toBeVisible();
  expect(screen.queryByText('Custom query error')).not.toBeInTheDocument();
  expect(screen.getByText('Choose a numeric field')).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Choose field' }));
  expect(onClick).toHaveBeenCalledTimes(1);
  expect(onClose).not.toHaveBeenCalled();
  const id = store.getSnapshot().items[0].id;
  await userEvent.click(screen.getByRole('button', { name: 'Explain with Assistant' }));
  expect(onInvestigateStatusItem).toHaveBeenCalledWith(id);
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('groups notice text while retaining per-query Assistant eligibility and custom actions', async () => {
  const store = new PanelStatusStore();
  const onInvestigateStatusItem = jest.fn();
  const onClick = jest.fn();
  const notice = { origin: 'notice' as const, severity: 'warning' as const, text: 'Partial result' };
  store.setExternal([
    { ...notice, id: 'A', refId: 'A' },
    { ...notice, id: 'B', refId: 'B', assistant: 'hidden' },
    { ...notice, id: 'C', refId: 'C', actions: [{ id: 'retry', label: 'Retry C', onClick }] },
  ]);
  const panel = new VizPanel({
    $data: new SceneDataNode({ data: { series: [], state: LoadingState.Done, timeRange: getDefaultTimeRange() } }),
    extendPanelContext: (_, context) => Object.assign(context, { notices: store, onInvestigateStatusItem }),
  });
  const tab = new InspectErrorsAndNoticesTab({ panelRef: panel.getRef() });
  render(<tab.Component model={tab} />);
  expect(screen.getAllByText('Partial result')).toHaveLength(2);
  expect(screen.getByText('A')).toBeVisible();
  expect(screen.getByText('B')).toBeVisible();
  const assistantButtons = screen.getAllByRole('button', { name: 'Explain with Assistant' });
  expect(assistantButtons).toHaveLength(2);
  await userEvent.click(assistantButtons[0]);
  expect(onInvestigateStatusItem).toHaveBeenCalledWith('external:A');
  await userEvent.click(screen.getByRole('button', { name: 'Retry C' }));
  expect(onClick).toHaveBeenCalledTimes(1);
});
