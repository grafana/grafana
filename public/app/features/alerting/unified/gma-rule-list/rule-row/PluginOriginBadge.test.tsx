import { HttpResponse, http } from 'msw';
import { render, screen } from 'test/test-utils';

import { setupMswServer } from '../../mockApi';

import { PluginOriginBadge } from './PluginOriginBadge';

const server = setupMswServer();

describe('PluginOriginBadge', () => {
  it('shows the plugin logo named after the plugin once its settings load', async () => {
    server.use(
      http.get('/api/plugins/my-app/settings', () =>
        HttpResponse.json({ id: 'my-app', name: 'My App', info: { logos: { small: '/my-app.svg' } } })
      )
    );

    render(<PluginOriginBadge pluginId="my-app" />);

    expect(await screen.findByRole('img', { name: 'My App' })).toHaveAttribute('src', '/my-app.svg');
  });

  // The plugin settings are cached per plugin id, so each case uses an id of its own.
  it.each([
    { name: 'are still loading', pluginId: 'slow-app', respond: () => new Promise<never>(() => {}) },
    { name: 'are not found', pluginId: 'missing-app', respond: () => HttpResponse.json({}, { status: 404 }) },
    { name: 'fail to load', pluginId: 'broken-app', respond: () => HttpResponse.json({}, { status: 500 }) },
  ])('keeps a badge with the plugin id while the settings $name', async ({ pluginId, respond }) => {
    server.use(http.get(`/api/plugins/${pluginId}/settings`, respond));

    render(<PluginOriginBadge pluginId={pluginId} />);

    expect(await screen.findByText(pluginId)).toBeInTheDocument();
  });
});
