import { act } from 'react';
import { render, screen, waitFor } from 'test/test-utils';

import { getDefaultTimeRange, LoadingState, toDataFrame, type PanelPluginVisualizationSuggestion } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { SceneQueryRunner, SceneTimeRange, VizPanel } from '@grafana/scenes';
import * as getAllSuggestionsModule from 'app/features/panel/suggestions/getAllSuggestions';

import { NotebookCellItem } from './NotebookCellItem';
import { NotebookLayoutManager } from './NotebookLayoutManager';
import { VizSuggestionsButton } from './VizSuggestionsButton';

jest.mock('app/features/panel/suggestions/getAllSuggestions');
jest.mock('app/features/panel/components/VizTypePicker/VisualizationSuggestionCard', () => ({
  VisualizationSuggestionCard: ({ suggestion }: { suggestion: { name: string } }) => <div>{suggestion.name}</div>,
}));

const mockGetAllSuggestions = jest.mocked(getAllSuggestionsModule.getAllSuggestions);

// Picking a suggestion runs changePluginType for real, which needs a plugin that actually loads
// rather than throwing on "Grafana instance has started" like an unconfigured one would.
setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({ id }).useFieldConfig()),
  getPanelPluginFromCache: () => undefined,
});

function suggestion(name: string, pluginId: string): PanelPluginVisualizationSuggestion {
  return { name, pluginId, hash: pluginId };
}

function setup() {
  const panel = new VizPanel({
    key: 'panel-1',
    pluginId: 'timeseries',
    $data: new SceneQueryRunner({ queries: [{ refId: 'A', datasource: { uid: 'prometheus' } }] }),
  });
  const cell = new NotebookCellItem({ elementName: 'panel-1', source: 'user', body: panel });
  new NotebookLayoutManager({ cells: [cell], $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }) });
  jest.spyOn(cell, 'onVisualizationChange');

  return { panel, cell };
}

function withData(panel: VizPanel) {
  const runner = panel.state.$data as SceneQueryRunner;
  act(() => {
    runner.setState({
      data: {
        state: LoadingState.Done,
        series: [toDataFrame({ fields: [{ name: 'value', values: [1] }] })],
        timeRange: getDefaultTimeRange(),
      },
    });
  });
}

beforeEach(() => {
  mockGetAllSuggestions.mockReset();
});

describe('VizSuggestionsButton', () => {
  it('prompts to run a query before there is data to suggest from', async () => {
    const { panel, cell } = setup();
    const { user } = render(<VizSuggestionsButton cell={cell} panel={panel} />);

    await user.click(screen.getByRole('button', { name: 'Change visualization' }));

    expect(await screen.findByText('Run a query to see visualization suggestions.')).toBeInTheDocument();
    expect(mockGetAllSuggestions).not.toHaveBeenCalled();
  });

  it('lists suggestions once data arrives, and applies the one picked', async () => {
    const { panel, cell } = setup();
    withData(panel);
    mockGetAllSuggestions.mockResolvedValue({
      suggestions: [suggestion('Table', 'table'), suggestion('Stat', 'stat')],
      hasErrors: false,
    });

    const { user } = render(<VizSuggestionsButton cell={cell} panel={panel} />);
    await user.click(screen.getByRole('button', { name: 'Change visualization' }));

    const tableCard = await screen.findByRole('button', { name: 'Table' });
    expect(screen.getByRole('button', { name: 'Stat' })).toBeInTheDocument();

    await user.click(tableCard);

    expect(cell.onVisualizationChange).toHaveBeenCalledWith(expect.objectContaining({ pluginId: 'table' }));
  });

  it('reports a load failure instead of an empty list', async () => {
    const { panel, cell } = setup();
    withData(panel);
    mockGetAllSuggestions.mockRejectedValue(new Error('plugin failed to load'));

    const { user } = render(<VizSuggestionsButton cell={cell} panel={panel} />);
    await user.click(screen.getByRole('button', { name: 'Change visualization' }));

    await waitFor(() => expect(screen.getByText('Could not load visualization suggestions.')).toBeInTheDocument());
  });

  it('says so when nothing suggests a visualization for this data', async () => {
    const { panel, cell } = setup();
    withData(panel);
    mockGetAllSuggestions.mockResolvedValue({ suggestions: [], hasErrors: false });

    const { user } = render(<VizSuggestionsButton cell={cell} panel={panel} />);
    await user.click(screen.getByRole('button', { name: 'Change visualization' }));

    expect(await screen.findByText('No visualization suggestions for this data.')).toBeInTheDocument();
  });
});
