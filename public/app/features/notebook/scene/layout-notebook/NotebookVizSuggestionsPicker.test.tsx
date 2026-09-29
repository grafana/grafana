import { render, screen } from 'test/test-utils';

import { type PanelPluginVisualizationSuggestion } from '@grafana/data';
import { VizPanel } from '@grafana/scenes';
import { mockComboboxRect } from '@grafana/test-utils';

import { NotebookVizSuggestionsPicker } from './NotebookVizSuggestionsPicker';

function suggestion(overrides: Partial<PanelPluginVisualizationSuggestion>): PanelPluginVisualizationSuggestion {
  return { pluginId: 'timeseries', name: 'Time series', hash: 'default-hash', options: {}, ...overrides };
}

describe('NotebookVizSuggestionsPicker', () => {
  beforeAll(() => {
    mockComboboxRect();
  });

  it('renders disabled with a hint when there are no suggestions yet', async () => {
    const panel = new VizPanel({ key: 'panel-1', pluginId: 'timeseries' });
    render(<NotebookVizSuggestionsPicker panel={panel} suggestions={[]} />);

    const combobox = await screen.findByRole('combobox', { name: 'Suggested visualization' });
    expect(combobox).toBeDisabled();
    expect(combobox).toHaveAttribute('placeholder', 'Run a query to see suggestions');
  });

  it('offers every suggestion as an option, defaulting to the top one', async () => {
    const panel = new VizPanel({ key: 'panel-1', pluginId: 'timeseries' });
    const suggestions = [
      suggestion({ hash: 'a', name: 'Time series' }),
      suggestion({ hash: 'b', name: 'Bar chart', pluginId: 'barchart' }),
      suggestion({ hash: 'c', name: 'Pie chart', pluginId: 'piechart' }),
    ];
    const { user } = render(<NotebookVizSuggestionsPicker panel={panel} suggestions={suggestions} />);

    await user.click(await screen.findByRole('combobox'));

    expect(await screen.findByRole('option', { name: 'Time series' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Bar chart' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Pie chart' })).toBeInTheDocument();
  });

  it('switches the panel plugin when a different suggestion is picked', async () => {
    const panel = new VizPanel({ key: 'panel-1', pluginId: 'timeseries' });
    const changePluginType = jest.spyOn(panel, 'changePluginType').mockResolvedValue(undefined);
    const suggestions = [
      suggestion({ hash: 'a', name: 'Time series', pluginId: 'timeseries' }),
      suggestion({ hash: 'b', name: 'Bar chart', pluginId: 'barchart', options: { showValue: 'always' } }),
    ];
    const { user } = render(<NotebookVizSuggestionsPicker panel={panel} suggestions={suggestions} />);

    await user.click(await screen.findByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'Bar chart' }));

    expect(changePluginType).toHaveBeenCalledWith('barchart', { showValue: 'always' }, undefined);
  });
});
