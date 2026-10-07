import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DataSourceApi, EventBusSrv, getDefaultTimeRange, LoadingState, PanelDiagnosticsStore } from '@grafana/data';
import { SceneDataNode, VizPanel } from '@grafana/scenes';
import type { PanelContext } from '@grafana/ui';

import { InspectErrorsAndNoticesTab } from './InspectErrorsAndNoticesTab';

class CustomDatasource extends DataSourceApi {
  query = jest.fn();
  testDatasource = jest.fn();
  components = { ErrorsAndNoticesInspector: () => <div>Datasource details</div> };
}

it('shows plugin-only diagnostics and callback actions alongside a custom inspector, then updates live', async () => {
  const store = new PanelDiagnosticsStore();
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
  const context: PanelContext = { diagnostics: store, eventsScope: 'panel', eventBus: new EventBusSrv() };
  const panel = new VizPanel({
    $data: new SceneDataNode({ data: { series: [], state: LoadingState.Done, timeRange: getDefaultTimeRange() } }),
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
  expect(screen.getByText('Choose a numeric field')).toBeVisible();
  expect(screen.getByText('Datasource details')).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Choose field' }));
  expect(onClick).toHaveBeenCalledTimes(1);
  act(() => source.set([{ id: 'field', severity: 'error', text: 'Field removed' }]));
  expect(screen.getByText('Field removed')).toBeVisible();
  expect(screen.queryByText('Choose a numeric field')).not.toBeInTheDocument();
  act(() => source.set([]));
  expect(screen.getByText('No errors or notices for this panel.')).toBeVisible();
  expect(screen.getByText('Datasource details')).toBeVisible();
});
