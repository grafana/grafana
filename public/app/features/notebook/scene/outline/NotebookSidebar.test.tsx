import { act, render, screen, within } from 'test/test-utils';

import { selectors } from '@grafana/e2e-selectors';
import { SceneRefreshPicker, SceneTimePicker, SceneTimeRange, VizPanel } from '@grafana/scenes';

import { NotebookScene } from '../NotebookScene';
import { NotebookCellItem } from '../layout-notebook/NotebookCellItem';
import { NotebookLayoutManager } from '../layout-notebook/NotebookLayoutManager';

import { NotebookSidebar } from './NotebookSidebar';

function markdown(key: string, text: string) {
  return new NotebookCellItem({ key, elementName: key, source: 'user', content: { kind: 'Markdown', spec: { text } } });
}

function panel(key: string, title: string) {
  return new NotebookCellItem({
    key,
    elementName: key,
    source: 'user',
    body: new VizPanel({ title, pluginId: 'timeseries' }),
  });
}

function buildScene(cells: NotebookCellItem[]) {
  return new NotebookScene({
    title: 'Checkout latency',
    body: new NotebookLayoutManager({ cells }),
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    timePicker: new SceneTimePicker({}),
    refreshPicker: new SceneRefreshPicker({}),
  });
}

async function openOutline(cells: NotebookCellItem[]) {
  const scene = buildScene(cells);
  const view = render(<NotebookSidebar scene={scene} stickyTop={0} />);
  await view.user.click(screen.getByRole('button', { name: 'Outline' }));
  return { scene, tree: screen.getByRole('tree', { name: 'Notebook outline' }), ...view };
}

describe('NotebookSidebar', () => {
  it('opens the content outline from the toolbar, rooted at the notebook with its headings collapsed', async () => {
    const { tree } = await openOutline([
      markdown('a', '# Overview'),
      markdown('b', '## Latency'),
      markdown('c', '# Findings'),
    ]);

    expect(screen.getByTestId(selectors.components.Sidebar.headerTitle)).toHaveTextContent('Content outline');
    expect(
      within(tree)
        .getAllByRole('button', { name: /^(?!Expand|Collapse)/ })
        .map((b) => b.textContent)
    ).toEqual(['Checkout latency', 'Overview', 'Findings']);
  });

  it('shows the panels under a heading once it is expanded, and keeps it expanded across reopening', async () => {
    const { tree, user } = await openOutline([
      markdown('a', '# Errors'),
      panel('p', 'Error rate'),
      markdown('c', '# Findings'),
    ]);

    await user.click(within(tree).getByRole('button', { name: 'Expand Errors' }));
    expect(within(tree).getByRole('button', { name: 'Error rate' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Outline' }));
    expect(screen.queryByRole('tree', { name: 'Notebook outline' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Outline' }));

    expect(screen.getByRole('button', { name: 'Error rate' })).toBeInTheDocument();
  });

  it('filters to matching entries and the headings above them', async () => {
    const { tree, user } = await openOutline([
      markdown('a', '# Errors'),
      panel('p', 'Error rate'),
      markdown('c', '# Findings'),
    ]);

    await user.type(screen.getByRole('textbox'), 'rate');

    expect(await within(tree).findByRole('button', { name: 'Error rate' })).toBeInTheDocument();
    expect(within(tree).getByRole('button', { name: 'Errors' })).toBeInTheDocument();
    expect(within(tree).queryByRole('button', { name: 'Findings' })).not.toBeInTheDocument();
  });

  it('says so when nothing matches the search', async () => {
    const { user } = await openOutline([markdown('a', '# Errors'), markdown('c', '# Findings')]);

    await user.type(screen.getByRole('textbox'), 'zzz');

    expect(await screen.findByText('No results found for your query')).toBeInTheDocument();
  });

  it('picks up a heading typed into an existing cell', async () => {
    const prose = markdown('b', 'prose');
    const { tree } = await openOutline([markdown('a', '# Overview'), prose]);

    // Content edits set state on the cell, never on the layout's cells list.
    act(() => prose.setState({ content: { kind: 'Markdown', spec: { text: '# Latency' } } }));

    expect(await within(tree).findByRole('button', { name: 'Latency' })).toBeInTheDocument();
  });

  it('picks up a heading cell added to the notebook', async () => {
    const { scene, tree } = await openOutline([markdown('a', '# Overview')]);
    const { body } = scene.state;

    act(() => body.setState({ cells: [...body.state.cells, markdown('c', '# Next steps')] }));

    expect(await within(tree).findByRole('button', { name: 'Next steps' })).toBeInTheDocument();
  });
});
