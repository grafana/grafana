import { selectOptionInTest } from 'test/helpers/selectOptionInTest';
import { render, screen, userEvent } from 'test/test-utils';

import { VizPanel } from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';

import { ConfigureInsightModal } from './ConfigureInsightModal';

function buildDashboard() {
  return new DashboardScene({
    title: 'Test dashboard',
    uid: 'test-uid',
    body: DefaultGridLayoutManager.fromVizPanels([
      new VizPanel({ key: 'panel-1', pluginId: '__unconfigured-panel' }),
      new VizPanel({ key: 'panel-2', pluginId: 'timeseries', title: 'Request latency' }),
      new VizPanel({ key: 'panel-3', pluginId: 'timeseries', title: 'Error rate' }),
    ]),
  });
}

function renderModal(onConfirm = jest.fn(), onDismiss = jest.fn()) {
  const dashboard = buildDashboard();
  render(<ConfigureInsightModal dashboard={dashboard} panelId={1} onDismiss={onDismiss} onConfirm={onConfirm} />);
  return { onConfirm, onDismiss };
}

describe('ConfigureInsightModal', () => {
  it('defaults to a prompt asking for insights', () => {
    renderModal();

    expect(screen.getByLabelText(/^Prompt/)).toHaveValue('Show insights of this panel or panels');
  });

  it('offers the other configured panels as context', async () => {
    renderModal();

    await selectOptionInTest(screen.getByLabelText('Panels'), 'Request latency (2)');

    expect(screen.getByText('Request latency (2)')).toBeInTheDocument();
  });

  it('cannot be confirmed until a panel is selected', async () => {
    renderModal();

    expect(screen.getByRole('button', { name: 'Create insight panel' })).toBeDisabled();

    await selectOptionInTest(screen.getByLabelText('Panels'), 'Error rate (3)');

    expect(screen.getByRole('button', { name: 'Create insight panel' })).toBeEnabled();
  });

  it('confirms with the selected panel context and prompt', async () => {
    const { onConfirm } = renderModal();

    await selectOptionInTest(screen.getByLabelText('Panels'), 'Error rate (3)');
    await userEvent.clear(screen.getByLabelText(/^Prompt/));
    await userEvent.type(screen.getByLabelText(/^Prompt/), 'Is this panel healthy?');
    await userEvent.click(screen.getByRole('button', { name: 'Create insight panel' }));

    expect(onConfirm).toHaveBeenCalledWith({
      prompt: 'Is this panel healthy?',
      context: {
        scope: 'panels',
        dashboardUid: 'test-uid',
        dashboardTitle: 'Test dashboard',
        panels: [{ panelId: 3, panelTitle: 'Error rate' }],
      },
    });
  });

  it('confirms with no panels when the whole dashboard is in scope', async () => {
    const { onConfirm } = renderModal();

    await userEvent.click(screen.getByRole('radio', { name: 'Whole dashboard' }));
    await userEvent.click(screen.getByRole('button', { name: 'Create insight panel' }));

    expect(screen.queryByLabelText('Panels')).not.toBeInTheDocument();
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ context: expect.objectContaining({ panels: [] }) })
    );
  });
});
