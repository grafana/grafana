import { screen } from '@testing-library/react';
import { render } from 'test/test-utils';

import { SceneTimeRange } from '@grafana/scenes';

import { DashboardScene } from '../DashboardScene';

import { NotebookCellItem } from './NotebookCellItem';
import { NotebookLayoutManager } from './NotebookLayoutManager';

function renderNotebook() {
  const cells = [
    new NotebookCellItem({
      elementName: 'md1',
      source: 'assistant',
      content: { kind: 'Markdown', spec: { text: 'Hello notebook' } },
    }),
    new NotebookCellItem({ elementName: 'hidden-panel', source: 'user', collapsed: true }),
  ];

  const manager = new NotebookLayoutManager({ cells, title: 'My notebook', tags: ['incident', 'checkout'] });

  // The renderer reads the time range from the scene graph, so the manager must be parented to a
  // scene that provides one.
  const scene = new DashboardScene({
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    body: manager,
  });
  scene.activate();

  render(<manager.Component model={manager} />);
}

describe('NotebookLayoutManager', () => {
  it('renders the document header with badge, title, time range and tags', async () => {
    renderNotebook();

    expect(screen.getByText('Published Notebook')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'My notebook' })).toBeInTheDocument();
    expect(screen.getByText(/now-6h/)).toBeInTheDocument();
    expect(screen.getByText('incident')).toBeInTheDocument();
    expect(screen.getByText('checkout')).toBeInTheDocument();
  });

  it('renders a narrative markdown cell and shows a collapsed cell by name only', async () => {
    renderNotebook();

    // Markdown content is rendered as sanitized HTML after mount.
    expect(await screen.findByText('Hello notebook')).toBeInTheDocument();
    // The collapsed cell renders only its element name, not its content.
    expect(screen.getByText('hidden-panel')).toBeInTheDocument();
  });
});
