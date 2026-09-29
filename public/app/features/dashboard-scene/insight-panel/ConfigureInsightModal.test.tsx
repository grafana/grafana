import { render, screen, userEvent } from 'test/test-utils';

import { SceneQueryRunner, VizPanel } from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';

import { ConfigureInsightModal } from './ConfigureInsightModal';

/** Only panels with a data provider can be insight sources. */
function panelWithData(key: string, title: string) {
  return new VizPanel({ key, title, pluginId: 'timeseries', $data: new SceneQueryRunner({ queries: [] }) });
}

function buildDashboard() {
  return new DashboardScene({
    title: 'Test dashboard',
    uid: 'test-uid',
    body: DefaultGridLayoutManager.fromVizPanels([
      new VizPanel({ key: 'panel-1', pluginId: '__unconfigured-panel' }),
      panelWithData('panel-2', 'Request latency'),
      panelWithData('panel-3', 'Error rate'),
    ]),
  });
}

function renderModal(onConfirm = jest.fn(), onDismiss = jest.fn()) {
  const dashboard = buildDashboard();
  render(<ConfigureInsightModal dashboard={dashboard} panelId={1} onDismiss={onDismiss} onConfirm={onConfirm} />);
  return { onConfirm, onDismiss };
}

describe('ConfigureInsightModal', () => {
  it('defaults to a question asking for insights', () => {
    renderModal();

    expect(screen.getByLabelText(/^Question/)).toHaveValue('Show insights of this panel or panels');
  });

  it('offers the dashboard panels that have queries as sources', () => {
    renderModal();

    expect(screen.getByLabelText('Request latency')).toBeInTheDocument();
    expect(screen.getByLabelText('Error rate')).toBeInTheDocument();
  });

  it('does not offer the panel being configured as its own source', () => {
    renderModal();

    expect(screen.queryByLabelText('panel-1')).not.toBeInTheDocument();
  });

  it('cannot be confirmed until a source panel is selected', async () => {
    renderModal();

    expect(screen.getByRole('button', { name: 'Create insight panel' })).toBeDisabled();

    await userEvent.click(screen.getByLabelText('Error rate'));

    expect(screen.getByRole('button', { name: 'Create insight panel' })).toBeEnabled();
  });

  it('confirms with the question and the selected source keys', async () => {
    const { onConfirm } = renderModal();

    await userEvent.click(screen.getByLabelText('Error rate'));
    await userEvent.clear(screen.getByLabelText(/^Question/));
    await userEvent.type(screen.getByLabelText(/^Question/), 'Is this panel healthy?');
    await userEvent.click(screen.getByRole('button', { name: 'Create insight panel' }));

    expect(onConfirm).toHaveBeenCalledWith({
      question: 'Is this panel healthy?',
      sourcePanelKeys: ['panel-3'],
      followUps: [],
    });
  });

  it('confirms with the author-defined follow-ups, dropping blank rows', async () => {
    const { onConfirm } = renderModal();

    await userEvent.click(screen.getByLabelText('Request latency'));
    await userEvent.click(screen.getByRole('button', { name: 'Add follow-up' }));
    await userEvent.type(screen.getByPlaceholderText('Which service drove the change?'), 'Which service?');
    // A second, left-blank row is in-progress input and must not become a follow-up.
    await userEvent.click(screen.getByRole('button', { name: 'Add follow-up' }));
    await userEvent.click(screen.getByRole('button', { name: 'Create insight panel' }));

    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ sourcePanelKeys: ['panel-2'], followUps: ['Which service?'] })
    );
  });
});
