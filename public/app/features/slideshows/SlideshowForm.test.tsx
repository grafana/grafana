import { render, screen, waitFor } from 'test/test-utils';

import { type Slideshow } from '@grafana/api-clients/rtkq/collections/v1alpha1';
import { registerPlaylistItemKind } from '@grafana/runtime';
import { resetPlaylistItemKindsForTests } from '@grafana/runtime/internal';

import { SlideshowForm } from './SlideshowForm';

const search = { dashboards: jest.fn(), pages: jest.fn() };

function slideshow(items: Slideshow['spec']['items'] = []): Slideshow {
  return {
    apiVersion: 'collections.grafana.app/v1alpha1',
    kind: 'Slideshow',
    metadata: { name: 'wall' },
    spec: { title: 'NOC wall', interval: '5m', items },
  };
}

function setup(items?: Slideshow['spec']['items']) {
  const onSubmit = jest.fn();
  const view = render(<SlideshowForm slideshow={slideshow(items)} onSubmit={onSubmit} />);
  return { ...view, onSubmit };
}

describe('SlideshowForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetPlaylistItemKindsForTests();
    search.dashboards.mockResolvedValue([{ name: 'cpu', title: 'CPU overview' }]);
    search.pages.mockResolvedValue([{ name: 'p1', title: 'Weekly SLO review' }]);
    registerPlaylistItemKind({
      group: 'dashboard.grafana.app',
      resource: 'dashboards',
      title: 'Dashboards',
      icon: 'apps',
      resolve: async (name) => (name === 'cpu' ? { url: '/d/cpu', title: 'CPU overview' } : undefined),
      search: search.dashboards,
    });
    registerPlaylistItemKind({
      group: 'assistant.ext.grafana.app',
      resource: 'pages',
      title: 'Pages',
      icon: 'file-alt',
      resolve: async (name) => ({ url: `/a/assistant/pages/${name}`, title: 'Weekly SLO review' }),
      search: search.pages,
    });
  });

  it('searches dashboards first and adds the chosen one as a group, resource and name', async () => {
    const { user, onSubmit } = setup();

    await user.click(screen.getByRole('combobox', { name: 'Add' }));
    await user.click(await screen.findByText('CPU overview'));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(search.pages).not.toHaveBeenCalled();
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        spec: {
          title: 'NOC wall',
          interval: '5m',
          items: [{ group: 'dashboard.grafana.app', resource: 'dashboards', name: 'cpu' }],
        },
      })
    );
  });

  it('shows the results of the kind picked in the dropdown', async () => {
    const { user, onSubmit } = setup();

    await user.click(screen.getByRole('combobox', { name: 'Kind' }));
    await user.click(await screen.findByText('Pages'));
    await user.click(screen.getByRole('combobox', { name: 'Add' }));
    await user.click(await screen.findByText('Weekly SLO review'));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit.mock.calls[0][0].spec.items).toEqual([
      { group: 'assistant.ext.grafana.app', resource: 'pages', name: 'p1' },
    ]);
  });

  it('shows the title of each item, and flags missing objects and unregistered kinds', async () => {
    setup([
      { group: 'dashboard.grafana.app', resource: 'dashboards', name: 'cpu', interval: '30s' },
      { group: 'dashboard.grafana.app', resource: 'dashboards', name: 'deleted' },
      { group: 'removed.example.app', resource: 'stuff', name: 'x' },
    ]);

    expect(await screen.findByText('CPU overview')).toBeInTheDocument();
    expect(await screen.findByText('Not found: dashboard.grafana.app/dashboards/deleted')).toBeInTheDocument();
    expect(screen.getByText('Unknown kind: removed.example.app/stuff/x')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Interval for item 1' })).toHaveValue('30s');
  });

  it('saves items in the order they were moved to, with per-item intervals and without display-only fields', async () => {
    const { user, onSubmit } = setup([
      { group: 'dashboard.grafana.app', resource: 'dashboards', name: 'cpu' },
      { group: 'assistant.ext.grafana.app', resource: 'pages', name: 'p1' },
    ]);
    await screen.findByText('Weekly SLO review');

    await user.click(screen.getAllByRole('button', { name: 'Move item up' })[1]);
    await user.type(screen.getByRole('textbox', { name: 'Interval for item 2' }), '30s');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0].spec.items).toEqual([
      { group: 'assistant.ext.grafana.app', resource: 'pages', name: 'p1' },
      { group: 'dashboard.grafana.app', resource: 'dashboards', name: 'cpu', interval: '30s' },
    ]);
  });

  it('removes an item', async () => {
    const { user, onSubmit } = setup([
      { group: 'dashboard.grafana.app', resource: 'dashboards', name: 'cpu' },
      { group: 'assistant.ext.grafana.app', resource: 'pages', name: 'p1' },
    ]);
    await screen.findByText('CPU overview');

    await user.click(screen.getAllByRole('button', { name: 'Delete item' })[0]);
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit.mock.calls[0][0].spec.items).toEqual([
      { group: 'assistant.ext.grafana.app', resource: 'pages', name: 'p1' },
    ]);
  });

  it('opens a slideshow stored without items as an empty one', async () => {
    const onSubmit = jest.fn();
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const stored = { ...slideshow(), spec: { title: 'Empty', interval: '5m', items: null } } as unknown as Slideshow;
    render(<SlideshowForm slideshow={stored} onSubmit={onSubmit} />);

    expect(await screen.findByText('This slideshow is empty. Add items below.')).toBeInTheDocument();
  });
});
