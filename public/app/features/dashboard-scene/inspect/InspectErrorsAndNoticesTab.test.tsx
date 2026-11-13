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

it('does not show a per-item Assistant action in the inspector', () => {
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

  act(() => {
    panel.getPanelContext().onInvestigateErrors = jest.fn();
    store.refresh();
  });
  expect(screen.queryByRole('button', { name: 'Fix with Assistant' })).not.toBeInTheDocument();
});

it('shows only the custom datasource inspector when provided', () => {
  const store = new PanelStatusStore();
  const source = store.createSource();
  source.set([
    {
      id: 'field',
      severity: 'warning',
      text: 'Choose a numeric field',
      actions: [{ id: 'choose', label: 'Choose field', onClick: jest.fn() }],
    },
  ]);
  const context: PanelContext = {
    notices: store,
    eventsScope: 'panel',
    eventBus: new EventBusSrv(),
  };
  const panel = new VizPanel({
    _pluginLoadError: 'Plugin failed to load',
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
  const tab = new InspectErrorsAndNoticesTab({ panelRef: panel.getRef(), dataSource: datasource });
  render(<tab.Component model={tab} />);
  expect(screen.getByText('Datasource details')).toBeVisible();
  expect(screen.queryByText('Custom query error')).not.toBeInTheDocument();
  expect(screen.queryByText('Plugin failed to load')).not.toBeInTheDocument();
  expect(screen.queryByText('Choose a numeric field')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Choose field' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Explain with Assistant' })).not.toBeInTheDocument();
});

it('groups notice text while retaining custom actions', async () => {
  const store = new PanelStatusStore();
  const onClick = jest.fn();
  const notice = { origin: 'notice' as const, severity: 'warning' as const, text: 'Partial result' };
  store.setExternal([
    { ...notice, id: 'A', refId: 'A' },
    { ...notice, id: 'B', refId: 'B' },
    { ...notice, id: 'C', refId: 'C', actions: [{ id: 'retry', label: 'Retry C', onClick }] },
  ]);
  const panel = new VizPanel({
    $data: new SceneDataNode({ data: { series: [], state: LoadingState.Done, timeRange: getDefaultTimeRange() } }),
    extendPanelContext: (_, context) => Object.assign(context, { notices: store }),
  });
  const tab = new InspectErrorsAndNoticesTab({ panelRef: panel.getRef() });
  render(<tab.Component model={tab} />);
  expect(screen.getAllByText('Partial result')).toHaveLength(2);
  expect(screen.getByText('A')).toBeVisible();
  expect(screen.getByText('B')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Explain with Assistant' })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Retry C' }));
  expect(onClick).toHaveBeenCalledTimes(1);
});
